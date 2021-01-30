'use strict'

const Jimp = require("jimp");
const Util = require('./Util');

/**
 * Class representing the password keypad used to compose your pin code
 */
class PasswordKeypad {

    /**
     * Create a new PasswordKeypad instance
     * @param {String|Buffer} keypadImage
     */
    constructor(keypadImage) {

        this.keypadImage = keypadImage;

        this.digitsPositions = [
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

    }

    /**
     * Returns the ordered digits contained in the password keypad
     * @return {Promise<Array<Number>>}
     */
    async getDigits() {

        const numberOfDigits = this.digitsPositions.length;

        // We load our labeled digits
        const labeledDigits = [];
        for (const digit of Util.range(numberOfDigits)) {
            labeledDigits.push(await Jimp.read(`keypad_digits/${digit}.png`));
        }

        // We extract each digit from the keypad
        const keypadDigits = [];
        for (const d of Util.range(numberOfDigits)) {
            const jimpKeypadImage = await Jimp.read(this.keypadImage);
            const digit = await jimpKeypadImage.crop(
                this.digitsPositions[d].x,
                this.digitsPositions[d].y,
                this.digitsPositions[d].width,
                this.digitsPositions[d].height
            );
            keypadDigits.push(digit);
        }

        // We associate each keypad digit to a labelled digit
        const resultDigits = []
        for (const keypadDigit of keypadDigits) {
            let closestDigit = 0;
            let closestPercentage = 1;
            for (const labeledDigit of Util.range(labeledDigits.length)) {
                const percentageValue = Jimp.diff(keypadDigit, labeledDigits[labeledDigit]).percent;
                if (percentageValue < closestPercentage) {
                    closestPercentage = percentageValue;
                    closestDigit = labeledDigit;
                }
            }
            resultDigits.push(closestDigit);
        }

        return resultDigits;
    }


    /**
     * Returns the click positions on the keypad to enter a given password
     * @param {Array<Number>} missingPasswordDigitsPositions
     * @param {String} password
     * @return {Promise<Array<Array<Number>>>}
     */
    async getClicksPositions(missingPasswordDigitsPositions, password) {

        const digits = await this.getDigits();

        // We identify the missing password digits (digits we need to click on)
        let passwordDigitsToClick = [];
        for (const passwordDigitPosition of missingPasswordDigitsPositions) {
            passwordDigitsToClick.push(parseInt(password[passwordDigitPosition - 1]));
        }

        // We generate a random click position for each digit we need to click on
        const clickPositions = [];
        for (const digitToClick of passwordDigitsToClick) {

            const digitIndexInKeypad = digits.indexOf(digitToClick);

            const clickPositionX = this.digitsPositions[digitIndexInKeypad].x + (Math.random() * this.digitsPositions[digitIndexInKeypad].width);
            const clickPositionY = this.digitsPositions[digitIndexInKeypad].y + (Math.random() * this.digitsPositions[digitIndexInKeypad].height);

            clickPositions.push([clickPositionX, clickPositionY]);
        }

        return clickPositions;
    }
}

module.exports = PasswordKeypad;
