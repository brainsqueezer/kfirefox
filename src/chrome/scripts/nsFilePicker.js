/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 2000 Netscape Communications Corporation.  All
 * Rights Reserved.
 *
 * Contributor(s): Stuart Parmenter <pavlov@netscape.com>
 */

/*
 * No magic constructor behaviour, as is de rigeur for XPCOM.
 * If you must perform some initialization, and it could possibly fail (even
 * due to an out-of-memory condition), you should use an Init method, which
 * can convey failure appropriately (thrown exception in JS,
 * NS_FAILED(nsresult) return in C++).
 *
 * In JS, you can actually cheat, because a thrown exception will cause the
 * CreateInstance call to fail in turn, but not all languages are so lucky.
 * (Though ANSI C++ provides exceptions, they are verboten in Mozilla code
 * for portability reasons -- and even when you're building completely
 * platform-specific code, you can't throw across an XPCOM method boundary.)
 */


const DEBUG = false; /* set to true to enable debug messages */

const FILEPICKER_CONTRACTID     = "@mozilla.org/filepicker;1";
const FILEPICKER_CID        = Components.ID("{54ae32f8-1dd2-11b2-a209-df7c505370f8}");
const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const APPSHELL_SERV_CONTRACTID  = "@mozilla.org/appshell/appShellService;1";
const STRBUNDLE_SERV_CONTRACTID = "@mozilla.org/intl/stringbundle;1";

const nsIAppShellService    = Components.interfaces.nsIAppShellService;
const nsILocalFile          = Components.interfaces.nsILocalFile;
const nsIFileURL            = Components.interfaces.nsIFileURL;
const nsISupports           = Components.interfaces.nsISupports;
const nsIFactory            = Components.interfaces.nsIFactory;
const nsIFilePicker         = Components.interfaces.nsIFilePicker;
const nsIInterfaceRequestor = Components.interfaces.nsIInterfaceRequestor
const nsIDOMWindow          = Components.interfaces.nsIDOMWindow;
const nsIStringBundleService = Components.interfaces.nsIStringBundleService;
const nsIWebNavigation      = Components.interfaces.nsIWebNavigation;
const nsIDocShellTreeItem   = Components.interfaces.nsIDocShellTreeItem;
const nsIBaseWindow         = Components.interfaces.nsIBaseWindow;

var   bundle                = null;
var   lastDirectory         = null;

function nsFilePicker()
{
  if (!bundle)
    bundle = srGetStrBundle("chrome://global/locale/filepicker.properties");

  /* attributes */
  this.mDefaultString = "";
  this.mFilterIndex = 0;
  if (lastDirectory) {
    this.mDisplayDirectory = Components.classes[LOCAL_FILE_CONTRACTID].createInstance(nsILocalFile);
    this.mDisplayDirectory.initWithPath(lastDirectory);
  } else {
    this.mDisplayDirectory = null;
  }
  this.mFilterTitles = new Array();
  this.mFilters = new Array();
}

nsFilePicker.prototype = {

  /* attribute nsILocalFile displayDirectory; */
  set displayDirectory(a) { this.mDisplayDirectory = a; },
  get displayDirectory()  { return this.mDisplayDirectory; },

  /* readonly attribute nsILocalFile file; */
  set file(a) { throw "readonly property"; },
  get file()  { return this.mFilesEnumerator.mFiles[0]; },

  /* readonly attribute nsISimpleEnumerator files; */
  set files(a) { throw "readonly property"; },
  get files()  { return this.mFilesEnumerator; },

  /* readonly attribute nsIFileURL fileURL; */
  set fileURL(a) { throw "readonly property"; },
  get fileURL()  {
    if (this.mFilesEnumerator) {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
      var url       = ioService.newFileURI(this.file);
      return url;
    }
    return null;
  },

  /* attribute wstring defaultString; */
  set defaultString(a) { this.mDefaultString = a; },
  get defaultString()  { return this.mDefaultString; },

  /* attribute wstring defaultExtension */
  set defaultExtension(ext) { },
  get defaultExtension() { return ""; },

  /* attribute long filterIndex; */
  set filterIndex(a) { this.mFilterIndex = a; },
  get filterIndex() { return this.mFilterIndex; },

  /* members */
  mFilesEnumerator: undefined,
  mParentWindow: null,

  /* methods */
  init: function(parent, title, mode) {
    this.mParentWindow = parent;
    this.mTitle = title;
    this.mMode = mode;
  },

  appendFilters: function(filterMask) {
    if (filterMask & nsIFilePicker.filterHTML) {
      this.appendFilter(bundle.GetStringFromName("htmlTitle"),
                   bundle.GetStringFromName("htmlFilter"));
    }
    if (filterMask & nsIFilePicker.filterText) {
      this.appendFilter(bundle.GetStringFromName("textTitle"),
                   bundle.GetStringFromName("textFilter"));
    }
    if (filterMask & nsIFilePicker.filterImages) {
      this.appendFilter(bundle.GetStringFromName("imageTitle"),
                   bundle.GetStringFromName("imageFilter"));
    }
    if (filterMask & nsIFilePicker.filterXML) {
      this.appendFilter(bundle.GetStringFromName("xmlTitle"),
                   bundle.GetStringFromName("xmlFilter"));
    }
    if (filterMask & nsIFilePicker.filterXUL) {
      this.appendFilter(bundle.GetStringFromName("xulTitle"),
                   bundle.GetStringFromName("xulFilter"));
    }
    if (filterMask & nsIFilePicker.filterApps) {
      // We use "..apps" as a special filter for executable files
      this.appendFilter(bundle.GetStringFromName("appsTitle"),
                        "..apps");
    }
    if (filterMask & nsIFilePicker.filterAll) {
      this.appendFilter(bundle.GetStringFromName("allTitle"),
                   bundle.GetStringFromName("allFilter"));
    }
  },

  appendFilter: function(title, extensions) {
    this.mFilterTitles.push(title);
    this.mFilters.push(extensions);
  },

  QueryInterface: function(iid) {
    if (!iid.equals(nsIFilePicker) &&
        !iid.equals(nsISupports))
        throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  },

  show: function() {
    var o = new Object();
    o.title = this.mTitle;
    o.mode = this.mMode;
    o.displayDirectory = this.mDisplayDirectory;
    o.defaultString = this.mDefaultString;
    o.filterIndex = this.mFilterIndex;
    o.filters = new Object();
    o.filters.titles = this.mFilterTitles;
    o.filters.types = this.mFilters;
    o.retvals = new Object();

    var parent;
    if (this.mParentWindow) {
      parent = this.mParentWindow;
    } else if (typeof(window) == "object" && window != null) {
      parent = window;
    } else {
      try {
        var appShellService = Components.classes[APPSHELL_SERV_CONTRACTID].getService(nsIAppShellService);
        parent = appShellService.hiddenDOMWindow;
      } catch(ex) {
        debug("Can't get parent.  xpconnect hates me so we can't get one from the appShellService.\n");
        debug(ex + "\n");
      }
    }

    var parentWin = null;
    try {
      parentWin = parent.QueryInterface(nsIInterfaceRequestor)
                        .getInterface(nsIWebNavigation)
                        .QueryInterface(nsIDocShellTreeItem)
                        .treeOwner
                        .QueryInterface(nsIInterfaceRequestor)
                        .getInterface(nsIBaseWindow);
    } catch(ex) {
      dump("file picker couldn't get base window\n"+ex+"\n");
    }

	var selectedFilePath = false;
	if (this.mMode = nsIFilePicker.modeSave)
		selectedFilePath = nsIFPcallKDialog (this.mTitle, this.mDefaultString, this.mFilters, this.mMode);
	else {
		var defaultDir = "~";

		try {
			defaultDir = this.mDisplayDirectory.path;
		} catch (ex) { }
		selectedFilePath = nsIFPcallKDialog (this.mTitle, defaultDir, this.mFilters, this.mMode);
	}


	if (selectedFilePath == false) {
		o.retvals.buttonStatus = nsIFilePicker.returnCancel;
	} else {
		/* Remove the trailing \n */
		if (selectedFilePath.substr(selectedFilePath.length-1) == "\n")
			selectedFilePath = selectedFilePath.substr(0, selectedFilePath.length-1);

		this.mFilterIndex = this.mFilterIndex;
		this.mFilesEnumerator = new Object();
		this.mFilesEnumerator.mFiles = Array();

		var selectedILocalFile = Components.classes["@mozilla.org/file/local;1"]
			        .createInstance(nsILocalFile);
		selectedILocalFile.initWithPath( selectedFilePath );

		this.mFilesEnumerator.mFiles.push(selectedILocalFile);
		lastDirectory = this.mDisplayDirectory;
		o.retvals.buttonStatus = nsIFilePicker.returnOK;
	}

	return o.retvals.buttonStatus;

/*
	try {
      if (parentWin)
        parentWin.blurSuppression = true;
      parent.openDialog("chrome://global/content/filepicker.xul",
                        "",
                        "chrome,modal,titlebar,resizable=yes,dependent=yes",
                        o);
      if (parentWin)
        parentWin.blurSuppression = false;

      this.mFilterIndex = o.retvals.filterIndex;
      this.mFilesEnumerator = o.retvals.files;
      lastDirectory = o.retvals.directory;
      return o.retvals.buttonStatus;
    } catch(ex) { dump("unable to open file picker\n" + ex + "\n"); }
	}

    return null; */
  }
}

if (DEBUG)
    debug = function (s) { dump("-*- filepicker: " + s + "\n"); }
else
    debug = function (s) {}

/* module foo */

var filePickerModule = new Object();

filePickerModule.registerSelf =
function (compMgr, fileSpec, location, type)
{
    debug("registering (all right -- a JavaScript module!)");
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    compMgr.registerFactoryLocation(FILEPICKER_CID,
                                    "FilePicker JS Component",
                                    FILEPICKER_CONTRACTID,
                                    fileSpec,
                                    location,
                                    type);
}

filePickerModule.getClassObject =
function (compMgr, cid, iid) {
    if (!cid.equals(FILEPICKER_CID))
        throw Components.results.NS_ERROR_NO_INTERFACE;

    if (!iid.equals(Components.interfaces.nsIFactory))
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    return filePickerFactory;
}

filePickerModule.canUnload =
function(compMgr)
{
    debug("Unloading component.");
    return true;
}

/* factory object */
var filePickerFactory = new Object();

filePickerFactory.createInstance =
function (outer, iid) {
    debug("CI: " + iid);
    debug("IID:" + nsIFilePicker);
    if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;

    return (new nsFilePicker()).QueryInterface(iid);
}

/* entrypoint */
function NSGetModule(compMgr, fileSpec) {
    return filePickerModule;
}



/* crap from strres.js that I want to use for string bundles since I can't include another .js file.... */

var strBundleService = null;

function srGetStrBundle(path)
{
  var strBundle = null;

  if (!strBundleService) {
    try {
      strBundleService = Components.classes[STRBUNDLE_SERV_CONTRACTID].getService(nsIStringBundleService);
    } catch (ex) {
      dump("\n--** strBundleService createInstance failed **--\n");
      return null;
    }
  }

  strBundle = strBundleService.createBundle(path);
  if (!strBundle) {
	dump("\n--** strBundle createInstance failed **--\n");
  }
  return strBundle;
}





function nsIFPcallKDialog (title, defaultPath, filter, mode)
{
	// Input check
	defaultPath = nsIFPaddSlashes(defaultPath);

/*
	if (!isArray(filter) || filter.length == 0) {
		filter = new Array();
		filter[0] = "*.*";
	}
*/
	if (title == "" || title == false)
		title = "Mozilla";


	// Temporary file where KDialog will store the selected file path
	var tmpFilePick = "/tmp/moz-" + Math.round(Math.random()*4294967296) + "-filepicker";

	var envProgram = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);
	if (!envProgram)
		throw "Unable to instance nsIFileSpec.";

	envProgram.nativePath = "/usr/bin/env";
	try {
		// FIXME: Calling kdialog makes Mozilla freeze and don't redraw the window.
		var cmdLine = "kdialog ";
		if (mode == nsIFilePicker.modeSave)					cmdLine += "--getsavefilename ";
		else if (mode == nsIFilePicker.modeGetFolder)		cmdLine += "--getexistingdirectory ";
		else 												cmdLine += "--getopenfilename ";

		cmdLine += "\"" + defaultPath + "\" ";

		// TODO: Add the filter
		if (mode != nsIFilePicker.modeGetFolder)
			cmdLine += "\"" + "*.*" + "\" ";

		// Add the title of the window
		cmdLine += "--title \"" + title + "\" ";
		// Redirect output to the temporary file
		cmdLine += ">" + tmpFilePick;
		ret = envProgram.execute (cmdLine);
	} catch (ex) {
		// The program might have not been found but it's also possible that
		// KDialog returned an error code because the user clicked Cancel
		// so we'll ignore this right now
	}

	var openFilePath = nsIFPreadFile (tmpFilePick);
	nsIFPdeleteFile (tmpFilePick);

	if (openFilePath == "" || openFilePath == false)
		return false;
	else return openFilePath;
}


function nsIFPreadFile (filename)
{
    //get a file component.  this is the core interface we need and it will be
    //used in a LOT of situations.

    var file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsILocalFile);

    //init the file since we can't use a constructor
    file.initWithPath( filename );

    //make sure we have this file.
    if ( file.exists() == false ) {
        return false;
    }

    var is = Components.classes["@mozilla.org/network/file-input-stream;1"]
        .createInstance( Components.interfaces.nsIFileInputStream );

    //init the file input stream... we don't need to pass any flags.
    is.init( file, 0, 0, 0 );

    //FIXME: get a scriptable input stream because the standard input stream can
    //not be used from JavaScript (fun huh!)

    var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
        .createInstance( Components.interfaces.nsIScriptableInputStream );

    sis.init( is );

    var output = sis.read( sis.available() );
	return output;
}

function nsIFPdeleteFile (filename)
{
	var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	if (aFile) {
		aFile.initWithPath(filename);
		aFile.remove(false);
	}
}

function nsIFPaddSlashes (s)
{
	var t = String(s);

	t.replace (/\\/g, "\\\\");			//				\   -->   \\
	t.replace (/"/g, "\\\"");			//				"   -->   \"
	t.replace (/$/g, "\\$");			//				$   -->   \$
	return t;
}
