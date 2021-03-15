'use strict';

/**
 * Class containing util functions
 */
class Util {
    /**
     * Returns an range array of n numbers
     * Example :
     * range(3) = [0, 1, 2]
     * @param {Number} n
     * @return {Array<Number>}
     */
    static range(n) {
        return Array.from(Array(n).keys());
    }
}

module.exports = Util;
