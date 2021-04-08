# ing-fr-unofficial-api

ING Bank FR Unofficial API (ing.fr)

## Purpose

This project is a NodeJS application that provides functions to get and post data to the ING API used by the official
ING web application. 
ING does not provide any support or documentation for this API as it should be only used by their mobile app and their website. 

This project is the result of a long reverse-engineering work.

**Use it at your own risks**.

## Installation

Clone the repository with ssh :

```shell
git clone git@github.com:GuillaumeKergreis/ing-fr-unofficial-api.git
```

or with https :

```shell
git clone https://github.com/GuillaumeKergreis/ing-fr-unofficial-api.git
```

Install the dependencies :

```shell
npm install
```


## How to use

### 1. Import the IngApi module in your project

```javascript
const ingApi = require('./IngApi');
```

### 2. Declare your ING credentials

```javascript
const customerId = process.env.CUSTOMER_ID; // e.g. 0123456789
const birthdate = process.env.BIRTHDATE; // e.g. 01011970 (DDMMYYYY format)
const password = process.env.PASSWORD; // e.g. 123456
```

### 3. Create a new instance of the ING API

```javascript
const ingApi = new IngApi(customerId, birthdate, password);
```

### 4. Connect you to the API

```javascript
await ingApi.connect();
```

### 5. Enjoy the multiple implemented endpoints and functions

Get your accounts :

```javascript
const accounts = await ingApi.getAccounts();
```

Get your transactions :

```javascript
const accounts = await ingApi.getAccountTransactions('ACCOUNT_ID');
```

Make a transfer (a 2FA SMS validation is mandatory) :

```javascript
await ingApi.makeTransfer('YOUR_DEBIT_ACCOUNT_ID', 'EXTERNAL_CREDIT_ACCOUNT_ID', 204.26, 'Transfer description');
```

## Validate a SMS

Some sensitive operations must be confirmed by a 2FA, mainly by SMS.

You'll find in the `app.js` file an endpoint example to post the code you received via SMS to validate the sensitive
operation.

Endpoint description :
```
POST localhost:8080/validation/sms
{
    validation: {
        operation: string,
        code: string
    }
}
```

Sensitives operations which need a 2FA :

- DISPLAY_TRANSACTIONS: Access to all the transactions of your account
- EXTERNAL_TRANSFER: Make an external wire transfer
- ADD_TRANSFER_BENEFICIARY: Add a new beneficiary

## Mobile app

A mobile app is currently in development, this one will provide an easy way to validate an SMS.

The idea is to wait for the validation SMS, once received, the app extract the sensitive operation type and the
validation code from the received SMS and post this information to the validation endpoint.

Another interesting feature will be to select the sensitive operations to perform automatically or not, giving you the
ability to just accept or reject an operation through a button click instead of typing the code.

