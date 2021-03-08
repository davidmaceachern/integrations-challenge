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

import 'dotenv/config';
import { URLSearchParams } from 'url';

const accountId: string = process.env.PK_TEST!;
const apiKey: string = process.env.SK_TEST!;

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

    interface IHTTPRequest<T> {
      method: T;
      headers?: { [x: string]: string };
    };

    type HTTPRequest = (IHTTPRequest<'post'> & { body: string });

    console.log('REQUEST IS');
    console.log(request);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${request.processorConfig.apiKey}`,
    };

    const url = 'https://api.stripe.com/v1/payment_intents';

    const urlSearchParams = new URLSearchParams({ 
        'amount': '2000', 
        'currency': 'gbp', 
        'payment_method_types[]': ['card']
    });

    const options: HTTPRequest = { 
      method: 'post', 
      headers: headers, 
      body: urlSearchParams.toString() 
    };

    const authorizationResponse = await HttpClient.request(url, options);
    console.log(authorizationResponse);
    function parseAuthorizationResponse(authorizationResponse) {
      console.log('PRINT PI')
      console.log(JSON.parse(authorizationResponse.responseText).client_secret)
      // { processorTransactionId: authorizationResponse.client_secret }
    }
    parseAuthorizationResponse(authorizationResponse);
    throw new Error('Method Not Implemented');
    // return new Promise(parseAuthorizationResponse(authorizationResponse));
  },

  /**
   * Capture a payment intent
   * This method should capture the funds on an authorized transaction
   */
  capture(
    request: RawCaptureRequest<APIKeyCredentials>,
  ): Promise<ParsedCaptureResponse> {
    throw new Error('Method Not Implemented');
  },

  /**
   * Cancel a payment intent
   * This one should cancel an authorized transaction
   */
  cancel(
    request: RawCancelRequest<APIKeyCredentials>,
  ): Promise<ParsedCancelResponse> {
    throw new Error('Method Not Implemented');
  },
};

export default StripeConnection;
