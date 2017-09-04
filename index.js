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

function waitForEvent(eventEmitter, eventName, filter, options) {
  if (filter && typeof filter !== 'function') {
    options = filter;
    filter = options.filter || null;
  }
  options = options || {};
  const logger = options.logger;

  return new Promise((resolve, reject) => {
    if (typeof logger === 'function') {
      logger(`Waiting for event: ${eventName}`);
    }

    if (options && options.timeout) {
      setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for event'));
      }, options.timeout);
    }

    function cleanup() {
      eventEmitter.removeListener(eventName, handler);
      return true;
    }

    function handler(event) {
      try {
        if (typeof filter === 'function' && typeof logger === 'function') {
          logger(`Filtering for event: ${eventName}`);
        }

        Promise.resolve(typeof filter === 'function' ? filter(event) : true)
          .then(match => {
            if (match) { cleanup() && resolve(event); }
          })
          .catch(err => {
            cleanup() && reject(err);
          });
      } catch (e) { 
        cleanup();
        reject(e);
      }
    }

    eventEmitter.on(eventName, handler);
  }).then(event => {
    if (typeof logger === 'function') {
      logger(`Got matching event: ${eventName}`);
    }

    return event;
  });
}

