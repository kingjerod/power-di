let fs = require("fs");
let path = require('path');
let util = require('./util.js');

class Container {
  constructor(config) {
    this.container = {};
    let defaultConfig = {
      prefix: '',
      npmPrefix: '',
      debug: false
    };
    for (let key in config) {
      defaultConfig[key] = config[key];
    }
    this.config = defaultConfig;
    this._debug('Set config: ' + JSON.stringify(this.config));
  }

  /**
   * Adds a directory of files to the container
   * @param directory
   * @param prefix
   */
  addDirectory(directory, prefix = this.config.prefix) {
    let files = fs.readdirSync(directory);
    this._debug('Adding directory: ' + directory);
    for (let file of files) {
      let fullPath = path.resolve(directory, file);
      let fileStats = fs.lstatSync(fullPath);
      if (fileStats.isDirectory()) {
        this.addDirectory(fullPath, prefix);
        continue;
      }
      if (path.extname(fullPath) === '.js') {
        this.addFile(fullPath, prefix);
      }
    }
  }

  addFile(fullPath, prefix = this.config.prefix) {
    var requiredFile = require(fullPath);
    var props = Object.getOwnPropertyNames(requiredFile);
    if (props.includes('ignore') && requiredFile['ignore']) {
      return;
    }

    this._debug('Processing file: ' + fullPath);
    if (requiredFile.prototype && requiredFile.prototype.constructor) {
      this._debug('_addClassDefinition: ')
      this._addClassDefinition(requiredFile, prefix);
    } else if (props.includes('factory')) {
      this._debug('_addFactory');
      this._addFactory(requiredFile, prefix);
    } else if (props.includes('constant')) {
      this._debug('_addConstant');
      this._addConstant(requiredFile, prefix);
    } else if (props.includes('function')) {
      this._debug('_addFunction');
      this._addFunction(requiredFile, prefix);
    }
  }

  addConstant(name, constant) {
    this._setDependency(name, {constant: constant, isConstant: true});
  }

  addFunction(name, func) {
    this._setDependency(name, {function: func, isFunction: true});
  }

  addFactory(name, factory) {
    this._setDependency(name, {factory: factory, isFactory: true});
  }

  has(depName) {
    return this.container[depName] != null;
  }

  get(depName, seenClasses = []) {
    if ((this.config.nodeModulePrefix && depName.startsWith(this.config.nodeModulePrefix)) || !this.has(depName)) {
      return this._getNodeModule(depName);
    }
    seenClasses.push(depName);

    let dependency = this.container[depName];
    if (dependency.isSingleton && dependency.instance) {
      return dependency.instance;
    }

    if (dependency.isFunction) {
      return dependency.function;
    }

    if (dependency.isConstant) {
      return dependency.constant;
    }

    if (dependency.isFactory) {
      return (dependency.factory)(this);
    }

    if (dependency.args) {
      // Need to resolve some dependencies
      let args = [null];
      for (let arg of dependency.args) {
        args.push(this.get(arg, seenClasses));
      }
      let instance = new (Function.prototype.bind.apply(dependency.file, args));
      if (dependency.isSingleton) {
        dependency.instance = instance;
      }
      return instance;
    } else {
      return new (dependency.file)();
    }
  }

  getClass(depName) {
    if (!this.has(depName)) {
      throw new Error('Container cannot find user module: ' + depName);
    }

    let dependency = this.container[depName];
    if (dependency.isFunction) {
      throw new Error('Cannot return class for dependency, it is a pre-made instance: ' + depName);
    }

    if (dependency.isConstant) {
      throw new Error('Cannot return class for dependency, it is a constant: ' + depName);
    }
    return dependency.file;
  }

  _getNodeModule(depName) {
    this._debug('_getNodeModule(' + depName + ')');
    if (util.nodeModuleExists(depName)) {
      this._debug('Returning exact NPM package: ' + depName);
      return require(depName);
    }

    let dashName = util.kebabCase(depName);
    if (util.nodeModuleExists(dashName)) {
      this._debug('Returning kebab case NPM package: ' + dashName);
      return require(dashName);
    }

    let dotName = dashName.replace(new RegExp('-', 'g'), '.');
    if (util.nodeModuleExists(dotName)) {
      this._debug('Returning dotName NPM package: ' + dotName);
      return require(dotName);
    }

    throw new Error('Container could not find NPM module: ' + depName);
  }

  _addClassDefinition(requiredFile, prefix) {
    let name = this._createDepName(requiredFile.depName || requiredFile.name, prefix);
    let args = util.getFunctionArgs(requiredFile.prototype.constructor);
    let isSingleton = (requiredFile.singleton === undefined || requiredFile.singleton === true);
    this._setDependency(name, {args: args, file: requiredFile, isClass: true, isSingleton: isSingleton});
  }

  _addConstant(requiredFile, prefix) {
    let name = this._createDepName(requiredFile.depName, prefix);
    this._setDependency(name, {constant: requiredFile.constant, isConstant: true});
  }

  _addFunction(requiredFile, prefix) {
    let name = this._createDepName(requiredFile.depName, prefix);
    this._setDependency(name, {function: requiredFile.function, isFunction: true});
  }

  _addFactory(requiredFile, prefix) {
    let name = this._createDepName(requiredFile.depName, prefix);
    this._setDependency(name, {factory: requiredFile.factory, isFactory: true});
  }

  _setDependency(name, dependency) {
    if (this.container[name]) {
      throw new Error('Duplicate dependency found: ' + name);
    }
    this._debug('Setting dependency for: ' + name);
    this.container[name] = dependency;
  }

  _createDepName(name, prefix = this.config.prefix) {
    return prefix + name;
  }

  _debug(msg) {
    if (this.config.debug) {
      this.config.debug(msg);
    }
  }

  _getContainer() {
    return this.container;
  }
}

module.exports = Container;
module.exports.create = function(config) {
  return new Container(config);
};
