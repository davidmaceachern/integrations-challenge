# Changelog

#### 2021, Tue, Mar 9

1. Working on Authorization:
    * Returning parsed authorization response. The test handles `failed` and `declined` responses but it does not assert that they occur. We would need to update the test with transaction details found [here](https://stripe.com/docs/testing#cards-responses) to be able to test how the integration handles `failed` and `declined` responses. I am going to assume that we want to make the test pass before we consider other application states, given we have two other pieces of functionality to investigate today.
    * Making payment method without payment method. Looks like we need to determine what transaction state will be. When we create a payment intent without a payment method it's available in Stripe system to interact with but is in state `incomplete`.
    * Considering the capture and cancel steps that need to be completed, let's pass the parameters required when authorizing a transaction to allow capturing, and then go on cancel the transaction as well.
    * Completed Authorization, taking given paramters in test, and setting to manual to enable capturing.
2. Working on Capturing payment:
    * I'm anticipating there'll be an issue we haven't considered such as the need to give a payment method, let's go ahead and see what we find. 
    * uncomment the tests for the capture method. We keep the first test running because we need to know if we break existing functionality.
    * Trying to make an initial request. As was suspected encountered `"message": "This PaymentIntent could not be captured because it has a status of requires_payment_method. Only a PaymentIntent with one of the following statuses may be captured: requires_capture."` which indicates the payment intent needs an additional step before capture.
    * Default behaviour is to await confirmation, we need to set payment confirm to `true` for the intent to be moved to a capturable state, [docs](https://stripe.com/docs/api/payment_intents/create#create_payment_intent-confirm).
    * Probably going to break the authorize function by making this work. Yup. Ok passing specific payment method value during the authorization step appears to work. More details about payment methods are available [here](https://stripe.com/docs/payments/payment-methods/transitioning#transitioning)
    * Suddenly thinking about security, as I'm working to figure out how to include payment method details the test provides in the authorization step it might not be a good idea to send someone's senstitive credit card details via a URL. Need to verify what the best practice for this is.
    * Sidenote: [Here](https://stripe.com/en-fr/payments/payment-methods-guide) can be found some details about which PSP's support which currencies. This might be something to consider if the Primer platform needs to support failing over between PSP's.
    * Ok attempting to create a payment method object using the paymentmethods API found [here](https://stripe.com/docs/api/payment_methods/create)
    * I wonder how many transaction this will take for me to complete!
    * Capture test criteria met, time to move onto cancelling transaction.
3. Working on Cancelling method:
    * It's possible for the customer to provide a cancellation reason. Given Primer is offering fraud provider integrations, this flag might be useful to support as part of this connection. Or additionally if the payment is abandoned.
    * Apparently American English more commonly uses `canceled` as opposed to `cancelled`.
4. Tidying up:
    * Whilst tidying up types, came across 
      > When providing a card number, you must meet the requirements for PCI compliance. We strongly recommend using Stripe.js instead of interacting with this API directly [link to docs](https://stripe.com/docs/security#validating-pci-compliance).
    * As I suspected Primer needs to be PCI Compliant, and to do so we need to think about [securing our sessions with SSL/TLS](https://stripe.com/docs/security/guide#setting-up-tls)
    * Pushed for the day.

10. Next steps:
    * Create tests for the missing Authorization states.
    * Refactor

#### 2021, Mon, Mar 8 

1. Getting Started:
    * Forked the challenge repo and cloned my fork `git clone https://github.com/davidmaceachern/integrations-challenge`
    * Checked I'm running right node version `v12.20.1`
    * Install yarn and then install dependencie with yarn `npm install -g yarn && yarn install`
    * Check the program prints out expected logs `yarn start:processors`
    * Following the steps defined for the challenge [connections](connections/README.md)
2. Working with Stripe:
    * Reset stripe account password
    * Visited `https://dashboard.stripe.com/test/apikeys` to obtain a key. It appears after signing up Stripe offers a test account until the account is officially activated.
    * copied locally to `.env` file, and added to `.gitignore`. Read more about both types of keys [here](https://stripe.com/docs/keys)
    * Added dotenv to load in the credentials so that they're not hardcoded. Used Typescripts [non-null-assertion-operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator) as we assume for this exercise the keys will always be there.
3. Checking out transaction lifecycle with Stripe's PaymentIntents API and documentation.
    * Reading through the PaymentIntents [documentation](https://stripe.com/docs/payments/payment-intents) it seems as opposed to full payment objects, a client secret is passed around that hides sensitive details but provides access to the request status. Now to understand what the functions we're expected to implement will require from the PaymentsIntent API [here](https://stripe.com/docs/api/payment_intents).
        ## Authorization 
        
        * (authorize function) - to enable a seperate capture step we need to create a `paymentintent` with `capture_method` set to manual. Details found [here](https://stripe.com/docs/payments/capture-later#authorize-only). It's recommended that you explicitly provide the payment_method going forward.
            ``` bash
            curl https://api.stripe.com/v1/payment_intents \
            -u
            $SK_TEST: \
            -d "amount"=1099 \
            -d "currency"="gbp" \
            -d "payment_method_types[]"="card" \
            -d "capture_method"="manual"
            ```
            ## Behaviour
            - Returns a PaymentIntent object.

            ## Edgecases
            - (Default) Stripe automatically captures funds when the customer authorizes the payment. 
            - Not all payment methods support capture later.
            - For in-person payments made with Terminal, the PaymentIntent must be captured within 24 hours.

        ## Capture 
        * (capture function) - Capture the funds of an existing uncaptured PaymentIntent when its status is `requires_capture` read more [here](https://stripe.com/docs/api/payment_intents/capture)
            ```bash
            curl https://api.stripe.com/v1/payment_intents/pi_1EUmyp2x6R10KRrhz0WmtMnF/capture \
            -u $SK_TEST: \
            -X POST
            ``` 
            ## Behaviour 
            - Returns a PaymentIntent object with status="succeeded" if the PaymentIntent was capturable. 
            - Returns an error if the PaymentIntent was not capturable or an invalid amount to capture was provided.

            ## Edgecases 
            1. The total authorized amount is captured by default—you can’t capture more than this. To capture less than the initial amount, pass the amount_to_capture option. Partially capturing automatically releases the remaining amount.
            2. Uncaptured PaymentIntents will be canceled exactly seven days after they are created. 
        ## Voiding 
        * (cancel function) endpoint found [here](https://stripe.com/docs/api/payment_intents/cancel)
            ```bash
            curl https://api.stripe.com/v1/payment_intents/pi_1EUmyo2x6R10KRrhUuJXu9m0/cancel \
            -u $SK_TEST: \
            -X POST
            ```
            ## Behaviour 
            - PaymentIntent object if the cancellation succeeded. 
            - Returns an error if the PaymentIntent has already been canceled or is not in a cancelable state.
            
            ## Edge cases
            1. Only card payments support separate authorization and capture. Other payment methods (e.g., ACH or iDEAL) cannot be first authorized and then captured, read more [here](https://stripe.com/docs/payments/capture-later#cancel-authorization).
            2. It's possible for refunds to fail and we would need to add a process that can receive a webhook to support this edge case, read more [here](https://stripe.com/docs/refunds#failed-refunds)
    * Essentially a client that uses stripe might have various use cases. 
        1. They might offer in store/person machine transactions that need to be captured within 24 hours.
        2. They might sell a service, or have a workflow that involves holding the money before capturing it.
        3. They might sell something where they need to collect the money immediately when the authorization step is performed.
        4. They might sell a product or service that has an associated refund step, it is assumed that the customer will care about whether they are recieving their refund or not so providing information about this will likely also be important.
4. Working with the Stripe API.
    * Using a rest client such as [Insomnia](https://insomnia.rest/), made some calls to the Stripe API to test it out. Useful for checking status of requests made as we write the code.
5. Working with main.ts:
    * In the order of the tests, auth, capture, and cancel.
        * Auth Test - Attempt to authorize a transaction for 10GBP, exit if error encountered, or if either failed or declined occurred otherwise return response. 
        * Capture test - Authorize Transaction and exit if not authorized. Continue attempt to capture and assert that transaction was settled. 
        * Cancel test - first authorize a transaction and exit if problem authorizing. Then call our cancel function exiting if an error occurs. Assertion will be printed if the transaction was not cancelled as expected
    * Assuming that the `main.ts` is the test suite that the `Stripe.ts` methods should be implemented against, there might be an issue with the transaction flow because as discovered whilst researching the transaction lifecycle an authorization can have a capture method of `automatic` or `manual`, with the default being automatic. This means the test data might not cover both eventualities, we either need to validate the requirements with what the user will expect to be able to do (speak to a user or business owner) or determine how we can handle this in `Stripe.ts` potentially only implementing one option for the purposes of this technical test.
6. Implementing the methods in `Stripe.ts`, commenting out other tests in `main.ts` so we only focus on one test at a time.
    * Installed [watchexec](https://github.com/watchexec/watchexec)
    * We can now run `watchexec -w ./connections/Stripe.ts -- yarn start:processors` and have the test suite run on each save of `Stripe.ts`.
    * Noted that Stripe's API returns a `docs_url` in response for bad requests which is a really helpful way to provide more details in addition to helpful error messages.
    