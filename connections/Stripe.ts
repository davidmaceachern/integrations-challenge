import {
  APIKeyCredentials,
  CardDetails,
  ParsedAuthorizationResponse,
  ParsedCancelResponse,
  ParsedCaptureResponse,
  ProcessorConnection,
  RawAuthorizationRequest,
  RawCancelRequest,
  RawCaptureRequest,
} from '@primer-io/app-framework';

import HttpClient from '../common/HTTPClient';
import {
  HTTPRequest,
  HTTPResponse
} from '../common/HTTPClient';

import 'dotenv/config';
import { URLSearchParams } from 'url';

const accountId: string = process.env.PK_TEST!;
const apiKey: string = process.env.SK_TEST!;

const lookUpTransactionStatus = {
  'requires_capture': 'AUTHORIZED',
  'card_declined': 'DECLINED',
  'succeeded': 'SETTLED',
  'canceled': 'CANCELLED',
};

const StripeConnection: ProcessorConnection<APIKeyCredentials, CardDetails> = {
  name: 'STRIPE',

  website: 'stripe.com',

  configuration: {
    accountId: accountId,
    apiKey: apiKey,
  },

  /**
   *
   * You should authorize a transaction and return an appropriate response
   */
  async authorize(
    request: RawAuthorizationRequest<APIKeyCredentials, CardDetails>,
  ): Promise<ParsedAuthorizationResponse> {

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${request.processorConfig.apiKey}`,
    };

    async function getPaymentMethodId(paymentMethodDetails): Promise<string> {

      const url: string = 'https://api.stripe.com/v1/payment_methods';

      const urlSearchParams = new URLSearchParams({
        'type': 'card',
        'card[number]': paymentMethodDetails.cardNumber,
        'card[exp_month]': paymentMethodDetails.expiryMonth,
        'card[exp_year]': paymentMethodDetails.expiryYear,
        'card[cvc]': paymentMethodDetails.cvv
      });

      const options: HTTPRequest = {
        method: 'post',
        headers: headers,
        body: urlSearchParams.toString()
      };

      const response: HTTPResponse = await HttpClient.request(url, options);
      const paymentMethodId: string = JSON.parse(response.responseText).id;

      return paymentMethodId
    }

    const paymentMethodId: string = await getPaymentMethodId(request.paymentMethod);

    const url: string = 'https://api.stripe.com/v1/payment_intents';

    const urlSearchParams: URLSearchParams = new URLSearchParams({
      'amount': request.amount.toString(),
      'currency': request.currencyCode,
      'capture_method': 'manual',
      'confirm': 'true',
      'payment_method_types[]': ['card'],
      'payment_method': paymentMethodId
    });

    const options: HTTPRequest = {
      method: 'post',
      headers: headers,
      body: urlSearchParams.toString()
    };

    const authorizationResponse: HTTPResponse = await HttpClient.request(url, options);

    function parseAuthorizationResponse(authorizationResponse: HTTPResponse): ParsedAuthorizationResponse {

      const jsonAuthorizationResponseText = JSON.parse(authorizationResponse.responseText);
      if (authorizationResponse.statusCode == 200 && jsonAuthorizationResponseText.status === "requires_capture") {
        return { processorTransactionId: jsonAuthorizationResponseText.id, transactionStatus: lookUpTransactionStatus[jsonAuthorizationResponseText.status] }
      }
      else if (jsonAuthorizationResponseText.error.code === 'card_declined' && jsonAuthorizationResponseText.error.decline_code === 'insufficient_funds') {
        return { transactionStatus: lookUpTransactionStatus[jsonAuthorizationResponseText.error.code], declineReason: 'INSUFFICIENT_FUNDS' }
      } else {
        return { errorMessage: 'There was a problem', transactionStatus: 'FAILED' }
      }
    };
    const parsedAuthorizationResponse: ParsedAuthorizationResponse = parseAuthorizationResponse(authorizationResponse);
    return parsedAuthorizationResponse;
  },

  /**
   * Capture a payment intent
   * This method should capture the funds on an authorized transaction
   */
  async capture(
    request: RawCaptureRequest<APIKeyCredentials>,
  ): Promise<ParsedCaptureResponse> {

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${request.processorConfig.apiKey}`,
    };

    const url: string = `https://api.stripe.com/v1/payment_intents/${request.processorTransactionId}/capture`;

    const options: HTTPRequest = {
      method: 'post',
      headers: headers,
      body: ''
    };

    const captureResponse: HTTPResponse = await HttpClient.request(url, options);

    function parseCaptureResponse(captureResponse: HTTPResponse): ParsedCaptureResponse {
      const jsonCaptureResponseText = JSON.parse(captureResponse.responseText);
      if (captureResponse.statusCode == 200 && jsonCaptureResponseText.status == 'succeeded') {
        return { transactionStatus: lookUpTransactionStatus[jsonCaptureResponseText.status] };
      } else {
        return { errorMessage: 'There was a problem', transactionStatus: 'FAILED' }
      }
    };

    const parsedCaptureResponse: ParsedCaptureResponse = parseCaptureResponse(captureResponse);

    return parsedCaptureResponse;
  },

  /**
   * Cancel a payment intent
   * This one should cancel an authorized transaction
   */
  async cancel(
    request: RawCancelRequest<APIKeyCredentials>,
  ): Promise<ParsedCancelResponse> {

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${request.processorConfig.apiKey}`,
    };

    const url: string = `https://api.stripe.com/v1/payment_intents/${request.processorTransactionId}/cancel`;

    const options: HTTPRequest = {
      method: 'post',
      headers: headers,
      body: ''
    };

    const cancelResponse: HTTPResponse = await HttpClient.request(url, options);

    function parseCancelResponse(cancelResponse: HTTPResponse): ParsedCancelResponse {
      const jsonCancelResponseText = JSON.parse(cancelResponse.responseText);
      if (cancelResponse.statusCode == 200 && jsonCancelResponseText.status == 'canceled') {
        return { transactionStatus: lookUpTransactionStatus[jsonCancelResponseText.status] };
      } else {
        return { errorMessage: 'There was a problem', transactionStatus: 'FAILED' }
      }
    };

    const parsedCancelResponse: ParsedCancelResponse = parseCancelResponse(cancelResponse);

    return parsedCancelResponse;
  },
};

export default StripeConnection;
