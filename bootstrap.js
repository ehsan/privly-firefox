/* ***** begin license block *****
 * version: mpl 1.1/gpl 2.0/lgpl 2.1
 *
 * the contents of this file are subject to the mozilla public license version
 * 1.1 (the "license"); you may not use this file except in compliance with
 * the license. you may obtain a copy of the license at
 * http://www.mozilla.org/mpl/
 *
 * software distributed under the license is distributed on an "as is" basis,
 * without warranty of any kind, either express or implied. see the license
 * for the specific language governing rights and limitations under the
 * license.
 *
 * the original code is restartless.
 *
 * the initial developer of the original code is the mozilla foundation.
 * portions created by the initial developer are copyright (c) 2010
 * the initial developer. all rights reserved.
 *
 * contributor(s):
 *   edward lee <edilee@mozilla.com>
 *
 * alternatively, the contents of this file may be used under the terms of
 * either the gnu general public license version 2 or later (the "gpl"), or
 * the gnu lesser general public license version 2.1 or later (the "lgpl"),
 * in which case the provisions of the gpl or the lgpl are applicable instead
 * of those above. if you wish to allow use of your version of this file only
 * under the terms of either the gpl or the lgpl, and not to allow others to
 * use your version of this file under the terms of the mpl, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the gpl or the lgpl. if you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the mpl, the gpl or the lgpl.
 *
 * ***** end license block ***** */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback) {
  // Wrap the callback in a function that ignores failures
  function watcher(window) {
    try {
      // Now that the window has loaded, only handle browser windows
      let {documentElement} = window.document;
      if (documentElement.getAttribute("windowtype") == "navigator:browser")
        callback(window);
    }
    catch(ex) {}
  }

  // Wait for the window to finish loading before running the callback
  function runOnLoad(window) {
    // Listen for one load event before checking the window type
    window.addEventListener("load", function runOnce() {
      window.removeEventListener("load", runOnce, false);
      watcher(window);
    }, false);
  }

  // Add functionality to existing windows
  let windows = Services.wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    // Only run the watcher immediately if the window is completely loaded
    let window = windows.getNext();
    if (window.document.readyState == "complete")
      watcher(window);
    // Wait for the window to load before continuing
    else
      runOnLoad(window);
  }

  // Watch for new browser windows opening then wait for it to load
  function windowWatcher(subject, topic) {
    if (topic == "domwindowopened")
      runOnLoad(subject);
  }
  Services.ww.registerNotification(windowWatcher);

  // Make sure to stop watching for windows if we're unloading
  unload(function() Services.ww.unregisterNotification(windowWatcher));
}

/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
function unload(callback, container) {
  // Initialize the array of unloaders on the first usage
  let unloaders = unload.unloaders;
  if (unloaders == null)
    unloaders = unload.unloaders = [];

  // Calling with no arguments runs all the unloader callbacks
  if (callback == null) {
    unloaders.slice().forEach(function(unloader) unloader());
    unloaders.length = 0;
    return;
  }

  // The callback is bound to the lifetime of the container if we have one
  if (container != null) {
    // Remove the unloader when the container unloads
    container.addEventListener("unload", removeUnloader, false);

    // Wrap the callback to additionally remove the unload listener
    let origCallback = callback;
    callback = function() {
      container.removeEventListener("unload", removeUnloader, false);
      origCallback();
    }
  }

  // Wrap the callback in a function that ignores failures
  function unloader() {
    try {
      callback();
    }
    catch(ex) {}
  }
  unloaders.push(unloader);

  // Provide a way to remove the unloader
  function removeUnloader() {
    let index = unloaders.indexOf(unloader);
    if (index != -1)
      unloaders.splice(index, 1);
  }
  return removeUnloader;
}

const SCRIPTS = [
  { id: "privly_ehi", url: "extension-host-intrface.js" },
  { id: "privly_obs", url: "observers.js" },
  { id: "privly_auth", url: "authentication.js" },
  { id: "privly_settings", url: "settings.js" },
];

const ELEMENTS = [
  {
    parent: "menu_ToolsPopup",
    tag: "menuitem",
    attrs: {
      id: "privly-menu-item",
      label: "Run Privly",
      key: "privly-run-key",
      oncommand: "privlyExtension.runPrivly()",
    }
  },
  {
    parent: "mainKeyset",
    tag: "key",
    attrs: {
      id: "privly-run-key",
      modifiers: "accel alt",
      key: "P",
      oncommand: "privlyExtension.runPrivly()",
    }
  },
    parent: "contentAreaContextMenu",
    tag: "menuitem",
    attrs: {
      id: "publicPostToPrivlyMenuItem",
      label: "Post Public Content to Privly",
      oncommand: "privlyExtension.postToPrivly('public')",
    }
  },
  {
    parent: "contentAreaContextMenu",
    tag: "menuitem",
    attrs: {
      id: "privatePostToPrivlyMenuItem",
      label: "Post Private Content to Privly",
      oncommand: "privlyExtension.postToPrivly('private')"",
    }
  },
  {
    parent: "contentAreaContextMenu",
    tag: "menuitem",
    attrs: {
      id: "loginToPrivlyMenuItem",
      label: "Login to Privly",
      oncommand: "privlyAuthentication.loginToPrivly()",
    }
  },
  {
    parent: "contentAreaContextMenu",
    tag: "menuitem",
    attrs: {
      id: "logoutFromPrivlyMenuItem",
      label: "Logout from Privly",
      oncommand: "privlyAuthentication.logoutFromPrivly()",
    }
  },
  {
    parent: "BrowserToolbarPalette",
    tag: "toolbarbutton",
    insertafter: "search-container",
    attrs: {
      id: "privly-tlbr-btn",
      label: "Privly",
      tooltiptext: "Privly",
      oncommand: "privlyExtension.toggleExtensionMode()",
    }
  },
];

function uninstallElement(window, id) {
  var doc = window.document;
  var elem = doc.getElementById(id);
  elem.parentNode.removeChild(elem);
}

function loadScript(window, id, url) {
  var doc = window.document;
  var script = doc.createElement("script");
  script.id = id;
  script.src = url;
  doc.documentElement.appendChild(script);

  unload(function() {
    uninstallElement(window, id);
  });
}

function installElement(window, parentID, child, attrs, insertafter) {
  var doc = window.document;
  var elem = doc.createElement(child);
  for (var attr in attrs) {
    elem.setAttribute(attr, attrs[attr]);
  }
  if (insertafter &&
      doc.getElementById(insertafter).nextSibling) {
    doc.getElementById(parentID).insertBefore(child,
        doc.getElementById(elem.insertafter).nextSibling);
  } else {
    doc.getElementById(parentID).appendChild(child);
  }

  unload(function() {
    uninstallElement(window, attrs["id"]);
  });
}

function installPrivlyOnWindow(window, addon) {
  for (var i = 0; i < SCRIPTS.length; ++i) {
    var script = SCRIPS[i];
    loadScript(window, script.id, addon.getResourceURI("scripts/" + script.url));
  }
  for (var i = 0; i < ELEMENTS.length; ++i) {
    var elem = ELEMENTS[i];
    installElement(window, elem.parent, elem.tag, elem.attrs, elem.insertafter);
  }
}

function startup(data, reason) {
  AddonManager.getAddonByID(data.id, function(addon) {
    watchWindows(function(window) {
      installPrivlyOnWindow(window, addon);
    });
  });
}

function shutdown(data, reason) {
  // Clean up with unloaders when we're deactivating
  if (reason != APP_SHUTDOWN)
    unload();
}

function install(data, reason) {}

function uninstall(data, reason) {}
