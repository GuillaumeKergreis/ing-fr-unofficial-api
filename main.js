'use strict';

const IngApi = require('./IngApi');

main();

/**
 * Example of the ING Api usage
 * @return {Promise<void>}
 */
async function main() {

    const customerId = process.env.CUSTOMER_ID; // e.g. 0123456789
    const birthdate = process.env.BIRTHDATE; // e.g. 01011970 (DDMMYYYY format)
    const password = process.env.PASSWORD; // e.g. 123456

    const ingApi = new IngApi(customerId, birthdate, password);
    await ingApi.connect();

    const accounts = await ingApi.getAccounts();
    console.log(accounts);

    const transactions = await ingApi.getAccountTransactions(accounts.accounts[0].uid, 0, 10);
    console.log(transactions);

    const lifeInsuranceAccount = await ingApi.getAccountById(accounts.accounts[1].uid);
    console.log(lifeInsuranceAccount);

    const lifeInsuranceContract = await ingApi.getLifeInsuranceContract(accounts.accounts[1].uid);
    console.log(lifeInsuranceContract);

}
