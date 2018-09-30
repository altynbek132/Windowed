const fullscreen_id_class = `--Windowed-long-id-that-does-not-conflict--`;
const fullscreen_id_class_select_only = `${fullscreen_id_class}-select`;
const fullscreen_id_cloned = `${fullscreen_id_class}-ugly-hacky-cloned`;
const fullscreen_parent = `${fullscreen_id_class}-parent`;
const body_class = `${fullscreen_id_class}-body`;
const transition_class = `${fullscreen_id_class}-transition`;
const transition_transition_class = `${fullscreen_id_class}-transition-transition`;

const popup_class = `${fullscreen_id_class}-popup`;

const max_z_index = '2147483647';

// Aliasses for different browsers (rest of aliasses are in the inserted script)
let fullscreenchange_aliasses = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
];
let requestFullscreen_aliasses = [
  'requestFullscreen',
  'mozRequestFullScreen',
  'webkitRequestFullscreen',
  'webkitRequestFullScreen',
  'msRequestFullscreen',
];
let exitFullscreen_aliasses = [
  'exitFullscreen',
  'webkitExitFullscreen',
  'webkitCancelFullScreen',
  'mozCancelFullScreen',
  'msExitFullscreen',
];
let fullscreenelement_aliasses = [
  'fullscreenElement',
  'webkitFullscreenElement',
  'mozFullscreenElement',
  'mozFullScreenElement',
  'msFullscreenElement',
  'webkitCurrentFullScreenElement',
];

let external_functions = {};
let next_id = 1;

let on_webpage = (strings, ...values) => {
  let result = strings[0];

  let value_index = 1;
  for (let value of values) {
    if (typeof value === 'string') {
      result = result + value;
    }
    if (typeof value === 'object') {
      result = result + JSON.stringify(value);
    }
    if (typeof value === 'function') {
      external_functions[next_id] = value;
      result = result + `external_function(${next_id});`;
      next_id = next_id + 1;
    }
    result = result + strings[value_index];
    value_index = value_index + 1;
  }

  return result;
};

let all_communication_id = 0;
let external_function_parent = (function_id) => async (...args) => {
  let request_id = `FROM_CONTENT:${all_communication_id}`;
  all_communication_id = all_communication_id + 1;

  if (window.parent === window) {
    return;
  }

  window.parent.postMessage({
    type: 'CUSTOM_WINDOWED_FROM_PAGE',
    request_id: request_id,
    function_id: function_id,
    args: args,
  }, '*');

  return new Promise((resolve, reject) => {
    let listener = (event) => {
      // We only accept messages from ourselves
      if (event.source != window.parent) return;
      if (event.data == null) return;

      if (event.data.type === 'CUSTOM_WINDOWED_TO_PAGE') {
        if (event.data.request_id === request_id) {
          window.removeEventListener('message', listener);
          resolve(event.data.result);
        }
      }
    }
    window.addEventListener('message', listener);
  });
}

// Insert requestFullScreen mock
const code_to_insert_in_page = on_webpage`{
  // Alliases for different browsers
  let requestFullscreen_aliasses = ${JSON.stringify(
    requestFullscreen_aliasses
  )};
  let exitFullscreen_aliasses = ${JSON.stringify(exitFullscreen_aliasses)};
  let fullscreenelement_aliasses = ${JSON.stringify(
    fullscreenelement_aliasses
  )};
  let fullscreenchange_aliasses = ${JSON.stringify(fullscreenchange_aliasses)};

  const send_event = (element, type) => {
    const event = new Event(type, {
      bubbles: true,
      cancelBubble: false,
      cancelable: false,
    });
    // if (element[\`on\${type}\`]) {
    //   element[\`on\${type}\`](event);
    // }
    element.dispatchEvent(event);
  };

  const send_fullscreen_events = (element) => {
    for (let fullscreenchange of fullscreenchange_aliasses) {
      send_event(document, fullscreenchange);
    }
    send_event(window, 'resize');
  };

  let all_communication_id = 0;
  let external_function = (function_id) => async (...args) => {
    let request_id = all_communication_id;
    all_communication_id = all_communication_id + 1;

    window.postMessage({
      type: 'CUSTOM_WINDOWED_FROM_PAGE',
      request_id: request_id,
      function_id: function_id,
      args: args,
    }, '*');

    return new Promise((resolve, reject) => {
      let listener = (event) => {
        // We only accept messages from ourselves
        if (event.source != window) return;
        if (event.data == null) return;

        if (event.data.type === 'CUSTOM_WINDOWED_TO_PAGE') {
          if (event.data.request_id === request_id) {
            window.removeEventListener('message', listener);
            resolve(event.data.result);
          }
        }
      }
      window.addEventListener('message', listener);
    });
  }

  let overwrite = (object, property, value) => {
    try {
      if (property in object) {
        Object.defineProperty(object, property, {
          value: value,
          configurable: true,
          writable: true,
        });
      }
    } catch (err) {
      // Nothing
    }
  }

  let set_fullscreen_element = (element = null) => {
    if (element == null) {
      throw new Error('WINDOWED: Got null in set_fullscreen_element');
    }

    overwrite(document, 'webkitIsFullScreen', true); // Old old old
    overwrite(document, 'fullscreen', true); // Old old old
    for (let fullscreenelement_alias of fullscreenelement_aliasses) {
      overwrite(document, fullscreenelement_alias, element);
    }
  }

  let make_tab_go_fullscreen = ${async () => {
    await go_into_fullscreen();
  }}

  let create_popup = ${async (is_already_fullscreen) => {
    create_style_rule();
    clear_popup();

    let is_fullscreen = await external_function_parent('is_fullscreen')();

    if (is_fullscreen) {
      await go_out_of_fullscreen();
      return 'EXIT';
    }

    let popup = createElementFromHTML(`
      <div class="${popup_class}" style="
        position: absolute;
        top: ${last_click_y}px;
        left: ${last_click_x}px;
        transform: translateX(-100%) translateY(-100%);
        background-color: white;
        border-radius: 3px;
        border: solid #eee 1px;
        box-shadow: 0px 2px 4px #00000026;
        padding-top: 5px;
        padding-bottom: 5px;
        font-size: 16px;
        color: black;
        min-width: 150px;
        z-index: ${max_z_index};
      ">
        <div data-target="windowed">
          <img
            src="${chrome.extension.getURL("Icons/Icon_Windowed@scalable.svg")}"
          />
          <span>Windowed</span>
        </div>
        <div data-target="fullscreen">
          <img
            src="${chrome.extension.getURL("Icons/Icon_EnterFullscreen@scalable.svg")}"
          />
          <span>Fullscreen</span>
        </div>
      </div>
    `);
    document.body.appendChild(popup);
    last_popup = popup;

    let result = await new Promise((resolve) => {
      for (let button of document.querySelectorAll(`.${popup_class} > div`)) {
        button.addEventListener(
          'click',
          () => {
            resolve(button.dataset.target);
          },
          {
            once: true,
          }
        );
      }
    });

    clear_popup();

    if (result === 'fullscreen') {
      let element = document.querySelector(
        `.${fullscreen_id_class_select_only}`
      );
      element.classList.remove(fullscreen_id_class_select_only);

      // TODO This now spawns fullscreen that returns to a separate window
      // .... when removed, because it is opened from the extension.
      // .... Need to open this on the original window.
      // NOTE This is the original fullscreen (in chrome at least)
      element.webkitRequestFullScreen();
      return 'FULLSCREEN';
    }
    if (result === 'windowed') {
      await go_into_fullscreen();
      return 'WINDOWED';
    }
    if (result === 'exit') {
      await go_out_of_fullscreen();
      return 'EXIT';
    }
  }}

  let make_tab_exit_fullscreen = ${async () => {
    await go_out_of_fullscreen();
    send_fullscreen_events();
  }}

  let exitFullscreen = async function(original) {
    let windowed_fullscreen = document.querySelector('.${fullscreen_id_class}');

    if (windowed_fullscreen) {
      // If the fullscreen element is a frame, tell it to exit fullscreen too
      if (typeof windowed_fullscreen.postMessage === 'function') {
        document.fullscreenElement.postMessage.sendMessage({ type: "exit_fullscreen_iframe" });
      }

      // Reset all the variables to their browser form
      delete window.screen.width;
      delete window.screen.height;
      delete document['webkitIsFullScreen'];
      delete document['fullscreen'];
      for (let fullscreenelement_alias of fullscreenelement_aliasses) {
        delete document[fullscreenelement_alias];
      }

      await make_tab_exit_fullscreen();
    } else {
      original();
    }
  }

  ${'' /* NOTE requestFullscreen */}
  const requestFullscreen = async function(original, force, ...args) {
    const element = this;
    element.classList.add('${fullscreen_id_class_select_only}');

    // Tell extension code (outside of this block) to go into fullscreen
    // window.postMessage({ type: force ? "enter_fullscreen" : "show_fullscreen_popup" }, "*");
    // send_windowed_event(element, force ? "enter_fullscreen" : "show_fullscreen_popup");
    if (force) {
      await make_tab_go_fullscreen();
    } else {
      let next = await create_popup();
    }
  }

  let finish_fullscreen = () => {
    // Because youtube actually checks for those sizes?!
    const window_width = Math.max(window.outerWidth, window.innerWidth);
    const window_height = Math.max(window.outerHeight, window.innerHeight);
    overwrite(window.screen, 'width', window_width);
    overwrite(window.screen, 'height', window_height);

    let element = document.querySelector('.${fullscreen_id_class_select_only}');
    set_fullscreen_element(element || document.body);
    send_fullscreen_events();
  }

  window.onmessage = (message) => {
    const frame = [...document.querySelectorAll('iframe')].find(x => x.contentWindow === message.source);

    if (frame || window.parent === message.source || message.target === message.source) {
      if (message.data && message.data.type === 'WINDOWED-confirm-fullscreen') {
        finish_fullscreen();
      }
    }

    if (frame != null && message.data) {
      if (message.data.type === 'enter_fullscreen_iframe') {
        // Call my requestFullscreen on the element
        requestFullscreen.call(frame, null, true);
      }
      if (message.data.type === 'exit_fullscreen_iframe') {
        // Call my exitFullscreen on the document
        exitFullscreen.call(document, original_exitFullscreen);
      }
    }
  }

  ${
    '' /* NOTE Replace all the `requestFullscreen` aliasses with calls to my own version */
  }
  let original_requestFullscreen = null;
  requestFullscreen_aliasses.forEach(requestFullscreenAlias => {
    if (typeof Element.prototype[requestFullscreenAlias] === 'function') {
      let original_function = Element.prototype[requestFullscreenAlias];
      original_requestFullscreen = original_function;
      Element.prototype[requestFullscreenAlias] = function(...args) {
        requestFullscreen.call(this, original_function.bind(this), ...args);
      };
    }
  });

  ${
    '' /* NOTE Replace all the `exitFullscreen` aliasses with calls to my own version */
  }
  let original_exitFullscreen = null;
  exitFullscreen_aliasses.forEach(exitFullscreenAlias => {
    if (typeof Document.prototype[exitFullscreenAlias] === 'function') {
      let original_function = Document.prototype[exitFullscreenAlias];
      original_exitFullscreen = original_function;
      Document.prototype[exitFullscreenAlias] = function(...args) {
        exitFullscreen.call(this, original_function.bind(this), ...args);
      };
    }
  });
}
`;

let elt = document.createElement('script');
elt.innerHTML = code_to_insert_in_page;
document.documentElement.appendChild(elt);
document.documentElement.removeChild(elt);

const send_event = (element, type) => {
  const event = new Event(type, {
    bubbles: true,
    cancelBubble: false,
    cancelable: false,
  });
  // if (element[\`on\${type}\`]) {
  //   element[\`on\${type}\`](event);
  // }
  element.dispatchEvent(event);
};

const send_fullscreen_events = () => {
  for (let fullscreenchange of fullscreenchange_aliasses) {
    send_event(document, fullscreenchange);
  }
  send_event(window, 'resize');
};

// setTimeout(() => {
//   for (let stylesheet of document.styleSheets) {
//     try {
//       for (let rule of stylesheet.cssRules) {
//         // Remove the css rule if the media query doesn't match,
//         // Force match it when it does
//         if (rule.media) {
//           if (window.matchMedia(rule.media.mediaText).matches) {
//             // console.log(`The media (${rule.media.mediaText}) matches!`);
//             rule.media.__WINDOWED_FALLBACK_MEDIATEXT__ = rule.media.mediaText;
//             rule.media.mediaText = "all";
//           } else {
//             // console.log(`The media (${rule.media.mediaText}) does not match!`);
//             rule.media.__WINDOWED_FALLBACK_MEDIATEXT__ = rule.media.mediaText;
//             rule.media.mediaText = "not all";
//           }
//         }
//       }
//     } catch (err) {
//       console.warn(`WINDOWED: Couldn't read stylesheet rules because of CORS...`);
//       console.log(`stylesheet:`, stylesheet)
//     }
//   }
// }, 1000);

// console.log('Runs in proper sandbox:', document.documentElement.constructor === HTMLHtmlElement);
// NOTE On chrome, extensions run in a proper sandbox (above will log true),
// meaning that you can't get access to the actual prototype-s of the Document and Elements-s,
// hence the need for the ugly script insert above.
// On Firefox however, this is not the case, and I might (because firefox screws me with CSP)
// need to use this quirk to work on all pages

let remove_domnoderemoved_listener = () => {};

let delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};

let has_style_created = false;
let create_style_rule = () => {
  if (has_style_created) {
    return;
  }
  has_style_created = true;

  let css = `
    .${body_class} .${fullscreen_id_class} {
      position: fixed !important;
      top: 0 !important;
      bottom: 0 !important;
      right: 0 !important;
      left: 0 !important;
      width: 100%;
      height: 100%;
      z-index: ${max_z_index} !important;
    }

    .${body_class} .${fullscreen_parent} {
      /* This thing is css black magic */
      all: initial;
      z-index: ${max_z_index} !important;

      /* Debugging */
      background-color: rgba(0,0,0,.1) !important;
    }

    /* Not sure if this is necessary, but putting it here just in case */
    .${body_class} .${fullscreen_parent}::before,
    .${body_class} .${fullscreen_parent}::after {
      display: none;
    }

    .${body_class} {
      /* Prevent scrolling */
      overflow: hidden !important;

      /* For debugging, leaving this just in here so I see when something goes wrong */
      /* background-color: rgb(113, 0, 180); */
    }

    /*
    .${transition_transition_class} {
      background-color: black !important;
    }

    .${transition_transition_class} body {
      transition: opacity .5s;
      opacity: 1;
    }

    .${transition_class} body {
      opacity: 0 !important;
    }
    */

    .${popup_class} > div {
      cursor: pointer;
      padding: 20px;
      padding-top: 4px;
      padding-bottom: 4px;
      background-color: white;

      display: flex;
      flex-direction: row;
      align-items: center;
    }

    .${popup_class} > div > img {
      height: 19px;
      margin-right: 16px;
    }

    .${popup_class} > div:hover {
      filter: brightness(0.9);
    }
  `;

  let styleEl = document.createElement('style');
  document.head.appendChild(styleEl);
  styleEl.appendChild(document.createTextNode(css));
};

const parent_elements = function*(element) {
  let el = element.parentElement;
  while (el) {
    yield el;
    el = el.parentElement;
  }
};

let send_chrome_message = (message) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, () => {
      resolve();
    });
  });
};

let last_click_x = null;
let last_click_y = null;
let last_popup = null;
let is_in_fullscreen = false;

let clear_popup = () => {
  if (last_popup != null) {
    try {
      document.body.removeChild(last_popup);
    } catch (err) {}
    last_popup = null;
  }
};

document.onclick = function(e) {
  last_click_x = e.pageX;
  last_click_y = e.pageY;
  clear_popup();
};

let createElementFromHTML = (htmlString) => {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
};

// document.addEventListener('__windowed__', e => {
//   console.log(`__windowed__ e:`, e);
//   e.detail.cb();
//   e.callback();
// })

let go_into_fullscreen = async () => {
  create_style_rule();
  let element = document.querySelector(`.${fullscreen_id_class_select_only}`);
  let cloned = element.cloneNode(true);

  remove_domnoderemoved_listener();
  var mutationObserver = new MutationObserver(async (mutations) => {
    for (let mutation of mutations) {
      for (let removed of mutation.removedNodes) {
        if (removed === element) {
          remove_domnoderemoved_listener();

          cloned.classList.add(fullscreen_id_cloned);
          cloned.classList.add(fullscreen_id_class_select_only);
          document.body.appendChild(cloned);
          go_into_fullscreen();

          await delay(500);
          if (cloned.contentWindow && cloned.contentWindow.postMessage) {
            cloned.contentWindow.postMessage(
              { type: 'WINDOWED-confirm-fullscreen' },
              '*'
            );
          }
        }
      }
    }
  });
  mutationObserver.observe(element.parentElement, {
    childList: true,
  });
  remove_domnoderemoved_listener = () => {
    mutationObserver.disconnect();
  }

  // remove_domnoderemoved_listener = async (e) => {
  //   return false;
  //
  //   let element = document.querySelector(`.${fullscreen_id_class}`);
  //   if (element == null) {
  //     document.removeEventListener(
  //       'DOMNodeRemoved',
  //       remove_domnoderemoved_listener
  //     );
  //   }
  //
  //   if (e.target.contains(element)) {
  //     // NOTE I first asked users here, but now I just force it hehe.
  //     // let try_anyway = window.confirm(
  //     //   'The page removed the element that was supposed to be fullscreen... this makes it impossible to show this windowed :(\n\nIt is possible that this works, you want to try anyway?'
  //     // );
  //     let try_anyway = true;
  //
  //     document.removeEventListener(
  //       'DOMNodeRemoved',
  //       remove_domnoderemoved_listener
  //     );
  //
  //     if (try_anyway) {
  //       // NOTE Honestly this stuff is messy and most likely leaves
  //       // .... lot of memory leaks and stuff...
  //       let cloned = element.cloneNode(true);
  //
  //       // await go_out_of_fullscreen();
  //
  //       cloned.classList.add(fullscreen_id_cloned);
  //       cloned.classList.add(fullscreen_id_class_select_only);
  //       document.body.appendChild(cloned);
  //       go_into_fullscreen();
  //
  //       await delay(500);
  //       if (cloned.contentWindow && cloned.contentWindow.postMessage) {
  //         cloned.contentWindow.postMessage(
  //           { type: 'WINDOWED-confirm-fullscreen' },
  //           '*'
  //         );
  //       }
  //     } else {
  //       go_out_of_fullscreen();
  //     }
  //   }
  // };
  // document.addEventListener('DOMNodeRemoved', remove_domnoderemoved_listener);

  element.classList.add(fullscreen_id_class);
  // Add fullscreen class to every parent of our fullscreen element
  for (let parent_element of parent_elements(element)) {
    parent_element.classList.add(fullscreen_parent);
  }

  if (window.parent !== window) {
    // Ask parent-windowed code to become fullscreen too
    window.parent.postMessage({ type: 'enter_fullscreen_iframe' }, '*');
  } else {
    // Send popup command to extension
    let menubar_size = window.outerHeight - window.innerHeight; // Asumme there is just header, no browser footer
    let rect = element.getBoundingClientRect();

    // rect.width
    let ratio_width = Math.min(rect.height / 9 * 16, rect.width); // 16:9
    let width_diff = rect.width - ratio_width;

    // document.documentElement.classList.add(transition_class);
    // document.documentElement.classList.add(transition_transition_class);

    // await delay(10);
    await send_chrome_message({
      type: 'please_make_me_a_popup',
      position: {
        height: rect.height,
        width: ratio_width,
        top: rect.top + menubar_size,
        left: rect.left + width_diff / 2,
      },
    });
    // await delay(10);
  }


  window.postMessage({ type: 'WINDOWED-confirm-fullscreen' }, '*');

  // Add no scroll to the body and let everything kick in
  document.body.classList.add(body_class);
  // document.documentElement.classList.remove(transition_class);
  // await delay(500);
  // document.documentElement.classList.remove(transition_transition_class);
};

let go_out_of_fullscreen = async () => {
  // Hide everything for a smooth transition
  // document.documentElement.classList.add(transition_class);
  // document.documentElement.classList.add(transition_transition_class);

  // Remove no scroll from body (and remove all styles)
  document.body.classList.remove(body_class);

  // Remove fullscreen class... from everything
  for (let element of document.querySelectorAll(`.${fullscreen_parent}`)) {
    element.classList.remove(fullscreen_parent);
  }

  remove_domnoderemoved_listener();

  const fullscreen_element = document.querySelector(
    `.${fullscreen_id_class_select_only}`
  );

  send_fullscreen_events();
  fullscreen_element.classList.remove(fullscreen_id_class_select_only);
  fullscreen_element.classList.remove(fullscreen_id_class);

  // If we are a frame, tell the parent frame to exit fullscreen
  // If we aren't (we are a popup), tell the background page to make me tab again
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'exit_fullscreen_iframe' }, '*');
  } else {
    await delay(10);
    await send_chrome_message({ type: 'please_make_me_a_tab_again' });
    await delay(500);
  }

  let cloned = document.querySelector(`.${fullscreen_id_cloned}`);
  if (cloned) {
    document.body.removeChild(cloned);
  }

  // document.documentElement.classList.remove(transition_class);
  // await delay(2000);
  // document.documentElement.classList.remove(transition_transition_class);
};

// document.addEventListener('CUSTOM_WINDOWED_TO_PAGE', async (event) => {
//   try {
//     let data = event.detail;
//     let fn = external_functions[data.function_id];
//     console.log(`event:`, data);
//     console.log(`fn:`, fn);
//     let result = await fn(event.target, ...data.args);
//     console.log(`result:`, result);
//     window.postMessage(
//       {
//         type: 'CUSTOM_WINDOW_TO_PAGE',
//         request_id: data.request_id,
//         result: result,
//       },
//       '*'
//     );
//   } catch (err) {
//     console.log(`err:`, err);
//   }
// });

external_functions.is_fullscreen = () => {
  const fullscreen_element = document.querySelector(
    `.${fullscreen_id_class}`
  );
  console.log(`fullscreen_element:`, fullscreen_element)
  return fullscreen_element != null;
}

window.addEventListener('message', async (event) => {
  // We only accept messages from ourselves
  if (event.data == null) return;
  if (event.data.type === 'CUSTOM_WINDOWED_FROM_PAGE') {
    let fn = external_functions[event.data.function_id];
    let result = await fn(...event.data.args);
    event.source.postMessage(
      {
        type: 'CUSTOM_WINDOWED_TO_PAGE',
        request_id: event.data.request_id,
        result: result,
      },
      '*'
    );
  }
});
