# Request Data Repro

This repository shows the problem in Chromium and Webkit were the request data
is not available for outgoing network requests that have a binary contents.

The test uses the `response`-event on the Page instance to listen for outgoing
requests to `app.posthog.com` domain and then keeps tap these requests and only
continues processing requests that meet the criteria:

  - The path name ends with `e/`, such as: https://app.posthog.com/e/?compression=gzip-js
  - Checks that the query parameter has `compression=gzip-js`

When the above criteria are met the tests are trying to retrieve the request data,
when the result of `response.postDataBuffer()` call is not `null` then we try
to decode the request data buffer by unzipping it and parse the returned string
into a JSON object.

If the JSON object is valid, and happens to be an array then we add each entry
of the array as an attachment for the report. In the test we then verify that we at least one attachment added to the report.

## Running tests

You can run the repro the following way:

```
npm install
npm run test
```

After running you will notice that the test failed for Webkit and Chromium while
it succeeded for Firefox.
