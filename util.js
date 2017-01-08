'use strict';

class Util {
  /**
   * Parses out source code of a required file, finding the constructor() method
   * and converting the args into an array.
   * Example: constructor($Apple, $Orange, puppy){} -> ['$Apple', '$Orange', 'puppy']
   * @param func
   * @returns {*}
   */
  getFunctionArgs(func) {
    let regex = /constructor\((.+)\)/i;
    let matches = func.toString().match(regex);
    if (matches && matches.length > 0) {
      matches = matches[1].split(',').map(function(arg){
        return arg.trim();
      });
      return matches;
    }
    return null;
  }

  /**
   * Checks if a node module exists and can be required()
   * @param name
   * @returns {boolean}
   */
  nodeModuleExists(name) {
    try {
      require.resolve(name);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Changes a string from appleOrange2 -> apple-orange-2
   * @param str
   * @returns {string}
   */
  kebabCase(str) {
    return str.replace(/[A-Z0-9]+/g, function (match) {
      return '-' + match.toLowerCase();
    });
  }
}

module.exports = new Util();
