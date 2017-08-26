/**
 * waitForEvent
 * eventEmitter     
 *    EventEmitter  
 *    object that will emit the event
 * eventName        
 *    String        
 *    the name of the event that will be emitted
 * filter           
 *    Promise(Boolean) function(event){}
 *    optional function returning whether or not the event satisfies conditions
 **/

module.exports = waitForEvent;

function waitForEvent(eventEmitter, eventName, filter) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      eventEmitter.removeListener(eventName, handler);
      return true;
    }

    function handler(event) {
      try {
        Promise.resolve(typeof filter === 'function' ? filter(event) : true)
          .then(match => {
            if (match) { cleanup() && resolve(event); }
          })
          .catch(err => {
            cleanup() && reject(err);
          });
      } catch (e) { 
        cleanup();
        throw e;
      }

    }

    eventEmitter.on(eventName, handler);
  });
}

