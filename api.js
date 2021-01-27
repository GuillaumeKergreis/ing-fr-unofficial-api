'use strict'

const fs = require('fs').promises;
const fetch = require('node-fetch');
const Jimp = require("jimp");

main();

async function main() {

    const customerId = process.env.CUSTOMER_ID; // e.g. 0123456789
    const birthdate = process.env.BIRTHDATE; // e.g. 01011970 (DDMMYYYY format)
    const password = process.env.PASSWORD; // e.g. 123456

    const sessionCookie = await connect(customerId, birthdate);

    console.log(sessionCookie);

    // await getConnected(sessionCookie);
    await getInformation(sessionCookie);

    const keypadPositions = await getKeypadPositions(sessionCookie);
    await getKeypadImage(sessionCookie);

    const digitPositions = [
        {x: 3, y: 3, width: 90, height: 88},
        {x: 99, y: 3, width: 90, height: 88},
        {x: 196, y: 3, width: 90, height: 88},
        {x: 293, y: 3, width: 90, height: 88},
        {x: 390, y: 3, width: 90, height: 88},
        {x: 3, y: 98, width: 90, height: 88},
        {x: 99, y: 98, width: 90, height: 88},
        {x: 196, y: 98, width: 90, height: 88},
        {x: 293, y: 98, width: 90, height: 88},
        {x: 390, y: 98, width: 90, height: 88}
    ];

    const keypadDigits = await getKeypadDigits(digitPositions);
    const clickPositions = await getPointsToClick(password, keypadPositions.pinPositions, keypadDigits, digitPositions);

    const postPinResult = await postPin(sessionCookie, clickPositions);

    const authenticatedSessionCookie = postPinResult.sessionCookie;
    const authToken = postPinResult.authToken;

    console.log(authToken);

    const session = await getSession(authenticatedSessionCookie, authToken);

    const accounts = await getAccounts(authenticatedSessionCookie, authToken);

}

async function connect(cif, birthDate) {
    const connectResponse = await fetch('https://m.ing.fr/secure/api-v1/login/cif?v2=true', {
        method: 'POST',
        body: JSON.stringify({cif, birthDate}),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const res = await connectResponse.json();
    const cookies = connectResponse.headers.get('Set-Cookie');

    console.log(res);

    return cookies;
}

/**
 *
 * @return {Promise<String>}
 */
async function getConnected(sessionCookie) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/login/cif', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
        }
    });
    const json = await res.json();
    console.log(json);

    return json;
}

async function getInformation(sessionCookie) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/login/informations', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
        }
    });
    const json = await res.json();
    console.log(json);

    return json;
}

async function getKeypadPositions(sessionCookie) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/login/keypad?v2=true', {
        method: 'POST',
        body: JSON.stringify({
            "keyPadSize": {
                "width": 3800,
                "height": 1520
            },
            "mode": ""
        }),
        headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
        }
    });
    const json = await res.json();
    console.log(json);

    return json;
}

async function getKeypadImage(sessionCookie) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/keypad/newkeypad.png', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
        }
    });
    const buffer = await res.buffer();

    await fs.mkdir('temp', {recursive: true});

    await fs.writeFile(`temp/keypad.png`, buffer);

    console.log('finished downloading!');
    console.log(buffer);
}

/**
 *
 * @param sessionCookie
 * @param clickPositions
 * @return {Promise<String>} authToken
 */
async function postPin(sessionCookie, clickPositions) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/login/sca/pin', {
        method: 'POST',
        body: JSON.stringify({'clickPositions': clickPositions}),
        headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Host': 'm.ing.fr',
            'Cookie': sessionCookie,
            'Connection': 'keep-alive'
        }
    });
    const json = await res.json();
    console.log(json);

    return {authToken: res.headers.get('Ingdf-Auth-Token'), sessionCookie: res.headers.get('Set-Cookie')};
}

async function getSession(sessionCookie, authToken) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/session', {
        method: 'GET',
        headers: {
            'Cookie': sessionCookie,
            'Ingdf-Auth-Token': authToken,
        }
    });
    const json = await res.json();
    console.log(json);

    return json;
}

async function getAccounts(sessionCookie, authToken) {
    const res = await fetch('https://m.ing.fr/secure/api-v1/accounts', {
        method: 'GET',
        headers: {
            'Cookie': sessionCookie,
            'Ingdf-Auth-Token': authToken,
        }
    });
    const json = await res.json();
    console.log(json);

    return json;
}

async function getKeypadDigits(digitPositions) {

    const keypadSize = {width: 484, height: 190};

    const numberOfDigits = 10;

    // We load our digits database
    const keypadDigits = [];
    for (let i = 0; i < numberOfDigits; i++) {
        keypadDigits.push(await Jimp.read('keypad_digits/' + i + ".png"));
    }

    // We extract each digit from the keypad
    const keypadToSolveDigits = [];
    for (let i = 0; i < numberOfDigits; i++) {
        const keypadToSolve = await Jimp.read("temp/keypad.png");
        const cropedDigit = await keypadToSolve.crop(digitPositions[i].x, digitPositions[i].y, digitPositions[i].width, digitPositions[i].height);
        keypadToSolveDigits.push(cropedDigit);
    }

    const resultDigits = []
    for (let i = 0; i < numberOfDigits; i++) {
        let closestDigit = 0;
        let closestPercentage = 1;
        for (let j = 0; j < numberOfDigits; j++) {
            const percentageValue = Jimp.diff(keypadToSolveDigits[i], keypadDigits[j]).percent;
            if (percentageValue < closestPercentage) {
                closestPercentage = percentageValue;
                closestDigit = j;
            }
        }
        resultDigits.push(closestDigit);
    }

    console.log(resultDigits);

    return resultDigits;
}

async function getPointsToClick(password, keypadPositions, keypadDigits, digitPositions) {

    let passwordDigitsToClick = [];
    for (const passwordDigitPosition of keypadPositions) {
        passwordDigitsToClick.push(parseInt(password[passwordDigitPosition - 1]));
    }

    const clickPositions = [];
    for (const digitToClick of passwordDigitsToClick) {

        const digitIndexInKeypad = keypadDigits.indexOf(digitToClick);

        const clickPositionX = digitPositions[digitIndexInKeypad].x + (Math.random() * digitPositions[digitIndexInKeypad].width);
        const clickPositionY = digitPositions[digitIndexInKeypad].y + (Math.random() * digitPositions[digitIndexInKeypad].height);

        clickPositions.push([clickPositionX, clickPositionY]);
    }

    return clickPositions;

}


