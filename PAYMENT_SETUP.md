# QueueUp payments (Opn / PromptPay)

The application uses a Firebase Cloud Function for PromptPay charges. Never put `OPN_SECRET_KEY` in `.env.local` or any Vite variable.

1. Create and verify an Opn merchant account, then enable PromptPay.
2. Dependencies are installed in `functions`. Authenticate with Firebase CLI, then set `OPN_SECRET_KEY` using Firebase Functions secrets and deploy the functions: `firebase functions:secrets:set OPN_SECRET_KEY` followed by `firebase deploy --only functions,firestore:rules`.
3. Seed the `products` Firestore collection. Payments intentionally refuse mock-only products, so the amount is always calculated on the server.
4. Deploy `opnWebhook`, copy its HTTPS URL to the Opn dashboard webhook configuration, and test it in test mode. The endpoint retrieves the charge with the secret key before marking the matching order paid.

`VITE_OPN_PUBLIC_KEY` is not required for the currently implemented PromptPay QR flow. It will be required before enabling card tokenization with Omise.js.
