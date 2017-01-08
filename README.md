# Power-DI
An auto-wiring dependency injection container with minimal configuration, no annotations. While most other DI containers require you to manually wire up your dependencies, or specify them twice, Power-DI figures out your dependencies based on your class constructor. Example:

```javascript
/* src/controllers/user.js */
class UserController {
    // UserService auto injected
    constructor(UserService) {
        this.UserService = UserService;
    }
    
    createUser(email, password) {
        this.UserService.create({email: email, password: password});
    }
}
module.exports = UserController;
```
```javascript
/* src/services/user.js */
class UserService {
    // NPM bcrypt module auto injected
    constructor(bcrypt) {
        this.bcrypt = bcrypt;
    }
    create(options) {
        var password = this.bcrypt.hash(options.password);
        // ...
    }
}
module.exports = UserService;
```
```javascript
/* src/index.js */
let container = require('power-di').create();
container.addDirectory('.'); //Scan all source files in current directory
let userController = container.get('UserController'); // UserService module and NPM module bcrypt auto injected
userController.createUser('bill@gates.com', 'SoRich');
```

Power-DI scans all the files inside the current directory, and auto inserts them into the container by their name. When container.get() is called, the class' constructor arguments are resolved from the container, and if they can't be found, they are required() from the installed NPM modules. Everything is automatically wired together, you don't need to specify the dependencies, that's what the constructor is for!

#### What's the point of dependency injection in NodeJS? A few things:
1. No more of this `require('../../../services/user.js');`
2. Related to the above point, you can move your files around and not worry about breaking requires.
3. Clear dependencies for your modules. Instead of requiring() everything at the top, you specify what you need. 
4. Easier to test, dependencies can be easily mocked without the use of rewire or proxyquire.

## Examples
Power-DI supports classes, constants, factories, and plain functions inside the container.

#### Creating the container

The container can be created using the factory function create() or calling new.
```javascript
let container = require('power-di').create();
// OR
let Container = require('power-di');
let container = new Container();
```

#### Classes
For classes, the dependency name will be taken from the class name. If you want to override the name, you can specify `depName` in the module.exports. Normally you would do `container.get('Dog')`, but after overriding it you would do `container.get('Wolf')`:

```javascript
class Dog {
}
module.exports = Dog;
module.exports['depName'] = 'Wolf';
```

By default, all classes are singletons (similar to standard NodeJS require). If you want to disable that, simply set `singleton = false`.
```javascript
class Dog {
}
module.exports = Dog;
module.exports['singleton'] = false;
```

Once a singleton class is instantiated, it is cached, and subsequent calls to fetch it from the container will return the same instance.

#### Constants
Constants are just an object to be returned. They could be a config object, a string, or a number. They can be created in a file or by the addConstant function.
 
```javascript
/* config.js*/
module.exports = {
    depName: 'Config',
    constant: {
        db : {
            user: 'bob',
            pass: 'ross'
        }
    }
};
```

```javascript
/* database.js */
class Database {
    constructor(Config) {
        this.user = Config.db.user;
        this.pass = Config.db.pass;
    }
}
module.exports = Database;
```

Using addConstant():

```
/* index.js */
let container = require('power-di').create();

container.addDirectory('.');
container.addConstant('Config', {
    db : {
        user: 'bob',
        pass: 'ross'
    }
});
```
 
 
#### Factory
The factory function is called with the container as the argument, so dependencies can be resolved inside the factory function. You can add factories with a seperate file, or with the addFactory function.
```javascript
/* car-factory.js*/
class Car {
  constructor(name) {
    this.name = name;
  }

  getName() {
    return 'My name is: ' + this.name;
  }
}

module.exports = {
  depName: 'Car',
  factory: function(container) {
    return new Car(container.get('CarName'));
  }
};
```

```
/* index.js */
let Container = require('power-di');
let container = new Container();

container.addConstant('CarName', 'Bobby Big Wheels');
container.addDirectory('.');
let car = container.get('Car');
console.log(car.getName()); //My name is: Bobby Big Wheels
```

Using addFactory():
```javascript
let Container = require('power-di');
let container = new Container();

class Car {
  constructor(name) {
    this.name = name;
  }
  getName() {
    return 'My name is: ' + this.name;
  }
};

container.addConstant('CarName', 'Bobby Big Wheels');
container.addFactory('Car', function(container){
  return new Car(container.get('CarName'));
});
let car = container.get('Car');
console.log(car.getName()); //My name is: Bobby Big Wheels

```

#### Simple Function
```javascript
/* add12.js*/
module.exports = {
  depName: 'Add12',
  function: function (x) {
    return x + 12;
  }
};
```

```javascript
/* index.js */
let Container = require('power-di');
let container = new Container();

container.addDirectory('.');
let add12 = container.get('Add12');
console.log(add12(4)); //16
```

Using addFunction():
```javascript
/* index.js */
let Container = require('power-di');
let container = new Container();

container.addFunction('Add12', function(x){
  return x + 12;
});

let add12 = container.get('Add12');
console.log(add12(4)); //16
```


### How to handle NPM modules with dashes or periods in the name like express-session or socket.io

To auto inject these types of NPM packages, simply convert the name to camelCase and use that in the constructor. Power-DI will convert the name first into the dashed version, check if a NPM package exists (require if it does), and then try the same with a period version. 

#### Express-session example. 
Here `expressSession` will get changed to `express-session` and then required(). 
```javascript
/* session-handler.js */
class SessionHandler {
    constructor(expressSession) {
        this.session = expressSession;
    }
}
module.exports = SessionHandler;
```

#### Socket.io example. 
Here `socketIo` will get changed to `socket-io` first, won't be found, and then `socket.io` will be found and required(). 
```javascript
/* socket-handler.js */
class SocketHandler {
    constructor(socketIo) {
        this.socketIo = socketIo;
    }
}
module.exports = SocketHandler;
```

### Configuration Options
You might be worried that having your source files along NPM module names will get confusing. That is why you can specify a prefix to use for either or both. 

#### Prefix '$' for your source modules:
```javascript
/* ball.js */
class Ball {
    squeeze() {
        console.log('Squeek!');
    }
}
module.exports = Ball;
```

```javascript
/* dog.js */
class Dog {
    constructor($Ball) {
        this.Ball = $Ball;
    }
    
    play() {
        this.Ball.squeeze();
    }
}
module.exports = Dog;
```

```javascript
/* index.js */
let Container = require('power-di');
let container = new Container({prefix: '$'}); //Set prefix here
container.addDirectory('.');
let dog = container.get('$Dog'); //Notice had to use prefix
dog.play(); // Squeek!
```

You only need to use the prefix when you are calling container.add*, container.get or specifying the dependencies in the constructor. You don't need to add the prefix when setting the depName in module.exports.

#### Prefix '$' for NPM modules:
```javascript
/* ball.js */
class Ball {
    squeeze() {
        console.log('Squeek!');
    }
}
module.exports = Ball;
```

```javascript
/* dog.js */
class Dog {
    constructor(Ball, $bcrypt) {
        this.Ball = Ball;
        this.bcrypt = $bcrypt
    }
    
    play() {
        this.Ball.squeeze();    
        this.password = this.bcrypt.hash('Treat?');
    }
}
module.exports = Dog;
```

```javascript
/* index.js */
let Container = require('power-di');
let container = new Container({npmPrefix: '$'}); //Set NPM prefix here
container.addDirectory('.');
let dog = container.get('Dog'); //Didn't use prefix
dog.play(); // Squeek!
```


#### Different prefix for both modules:
```javascript
/* ball.js */
class Ball {
    squeeze() {
        console.log('Squeek!');
    }
}
module.exports = Ball;
```

```javascript
/* dog.js */
class Dog {
    constructor(_Ball, $bcrypt) {
        this.Ball = _Ball;
        this.bcrypt = $bcrypt
    }
    
    play() {
        this.Ball.squeeze();    
        this.password = this.bcrypt.hash('Treat?');
    }
}
module.exports = Dog;
```

```javascript
/* index.js */
let Container = require('power-di');
let container = new Container({prefix: '_', npmPrefix: '$'}); //Set prefix here
container.addDirectory('.');
let dog = container.get('_Dog');
dog.play(); // Squeek!
```
