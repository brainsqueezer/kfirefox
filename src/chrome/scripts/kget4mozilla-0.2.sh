#!/bin/bash
VERSION=0.2

# Get the directory where Mozilla is
BASEDIR=`pwd`
if [ $1 ]; then
  BASEDIR=$1
fi


# Guess if it's Mozilla or Firefox
MOZILLABIN="$BASEDIR/mozilla-bin"
FIREFOXBIN="$BASEDIR/firefox-bin"
if [ -x $MOZILLABIN ]; then
  ISMOZILLA="1"
  BROWSERNAME="Mozilla"
elif [ -x $FIREFOXBIN ]; then
  ISMOZILLA=""
  BROWSERNAME="Firefox"
else
  if [ $1 ]; then
    echo "Error: The directory you have specified doesn't contain a Mozilla or Firefox installation."
  else
    echo "Error: Couldn't find a Mozilla or Firefox installation directory. You may either run this script from your"
	echo "Mozilla/Firefox installation directory or pass it as a parameter. For example:"
	echo
	echo "$0 /usr/local/mozilla-v1.7.2"
  fi
  exit
fi


if [ $ISMOZILLA ]; then
  # It's chrome/comm.jar
  JARFILE=$BASEDIR/chrome/comm.jar
else
  # It's chrome/browser.jar
  JARFILE=$BASEDIR/chrome/browser.jar
fi

# Check if the jar file exists
if [ ! -f $JARFILE ]; then
  echo "Error: Couldn't find \"$JARFILE\"."
fi


# Check if KGet is in the path
which kget >/dev/null 2>&1
if [ $? = 1 ]; then
  echo "WARNING: KGet was not found in your path. Make sure you have it installed and it's in your path."
fi

# Check if we have write permissions in chrome
TESTFILE=$BASEDIR/chrome/testfile1234567890.test
touch $TESTFILE >/dev/null 2>&1
if [ ! -f $TESTFILE ]; then
  if [ $UID != "0" ]; then
    echo "You don't have write permissions in $BASEDIR/chrome. Please enter the root password."
	su -c "echo ; echo ; $0 $1"
  else
    echo "Error: Unable to write into $BASEDIR/chrome. Check the permissions."
  fi
  exit
fi
rm -f $TESTFILE


# Display credits
echo "KGet integration for Mozilla and Firefox $VERSION, by Victor Fernandez"
echo "Mozillux project - http://www.polinux.upv.es/mozilla"
echo


# Restore the backup jar file if there is one and if not create one
if [ -f $JARFILE.backup ]; then
  echo "Restoring the backup of $JARFILE (backup file retained)"
  cp -f $JARFILE.backup $JARFILE
else
  echo "Creating a backup of $JARFILE"
  cp -f $JARFILE $JARFILE.backup
fi


# Create a temporary directory
TEMPORARYDIR="/tmp/kget4mozilla-$VERSION"
echo "Extracting into $TEMPORARYDIR"
rm -Rf $TEMPORARYDIR
mkdir -p $TEMPORARYDIR
unzip -q $JARFILE -d $TEMPORARYDIR




# Patch contentAreaUtils.js
if [ $ISMOZILLA ]; then
  echo "Patching content/communicator/contentAreaUtils.js"
  PATCHINGFILE=$TEMPORARYDIR/content/communicator/contentAreaUtils.js
  REPLACETEXT="function saveURL(aURL, aFileName, aFilePickerTitleKey, aShouldBypassCache)"

  # Replace text in saveURL() function
  NUMLINES=`cat $PATCHINGFILE | wc -l`
  MATCHINGLINE=`grep -n "$REPLACETEXT" $PATCHINGFILE | cut -d : -f 1`
  head -n $MATCHINGLINE $PATCHINGFILE >$PATCHINGFILE.tmp
  cat >>$PATCHINGFILE.tmp <<EOL
{
  // Check the preferences to know if the user wanted to use a download manager
  // Move this back to the contextMenu
  var useDownloadManager = false;
  if (pref) {
    try {
      useDownloadManager = (pref.getIntPref("browser.downloadmanager.behavior") == 0);
    } catch(ex) {
    }
  }
  if (useDownloadManager) {
    if (queryDownloadManager (aURL))
      return;
  }

EOL
  LASTLINES=`expr $NUMLINES - $MATCHINGLINE - 1`
  tail -n $LASTLINES $PATCHINGFILE >>$PATCHINGFILE.tmp
  mv -f $PATCHINGFILE.tmp $PATCHINGFILE

else
  echo "Patching content/browser/contentAreaUtils.js"
  PATCHINGFILE=$TEMPORARYDIR/content/browser/contentAreaUtils.js
  REPLACETEXT="function saveURL(aURL, aFileName, aFilePickerTitleKey, aShouldBypassCache, aSkipPrompt)"

  # Replace text in saveURL() function
  NUMLINES=`cat $PATCHINGFILE | wc -l`
  MATCHINGLINE=`grep -n "$REPLACETEXT" $PATCHINGFILE | cut -d : -f 1`
  head -n $MATCHINGLINE $PATCHINGFILE >$PATCHINGFILE.tmp
  cat >>$PATCHINGFILE.tmp <<EOL
{
  if (queryDownloadManager (aURL))
      return;

EOL
  LASTLINES=`expr $NUMLINES - $MATCHINGLINE - 1`
  tail -n $LASTLINES $PATCHINGFILE >>$PATCHINGFILE.tmp
  mv -f $PATCHINGFILE.tmp $PATCHINGFILE
fi



# Add queryDownloadManager
cat >>$PATCHINGFILE <<EOL

function queryDownloadManager(url)
{
	var command = "/bin/bash";
	var args = new Array();
	args.push ("-c");
	args.push ("kget \"" + url + "\"");

	try {
		var applicFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		var applic = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
		applicFile.initWithPath(command);
		if (! applicFile.exists()) {
			return false;
		} else {
			applic.init(applicFile);
			applic.run(false, args, args.length);
		}
	} catch (e) {
		return false;
	}
	return true;
}
EOL





# If Mozilla, patch tasksOverlay.js
if [ $ISMOZILLA ]; then
  echo "Patching content/communicator/tasksOverlay.js"
  PATCHINGFILE=$TEMPORARYDIR/content/communicator/tasksOverlay.js

  # Replace text in saveURL() function
  NUMLINES=`cat $PATCHINGFILE | wc -l`
  REPLACETEXT="function toDownloadManager()"
  MATCHINGLINE=`grep -n "$REPLACETEXT" $PATCHINGFILE | cut -d : -f 1`
  head -n $MATCHINGLINE $PATCHINGFILE >$PATCHINGFILE.tmp
  cat >>$PATCHINGFILE.tmp <<EOL
{
  // Try to open the KDE Download Manager (KGet) and if it fails open the Mozilla internal download manager
  if (openKDEDownloadManager())
    return;

EOL
  LASTLINES=`expr $NUMLINES - $MATCHINGLINE - 1`
  tail -n $LASTLINES $PATCHINGFILE >>$PATCHINGFILE.tmp
  mv -f $PATCHINGFILE.tmp $PATCHINGFILE

# If Firefox, patch browser.js
else
  echo "Patching content/browser/browser.js"
  PATCHINGFILE=$TEMPORARYDIR/content/browser/browser.js

  # Replace text in saveURL() function
  NUMLINES=`cat $PATCHINGFILE | wc -l`
  REPLACETEXT="function toOpenWindowByType(inType, uri, features)"
  MATCHINGLINE=`grep -n "$REPLACETEXT" $PATCHINGFILE | cut -d : -f 1`
  head -n $MATCHINGLINE $PATCHINGFILE >$PATCHINGFILE.tmp
  cat >>$PATCHINGFILE.tmp <<EOL
{
  if (uri == 'chrome://mozapps/content/downloads/downloads.xul') {
    // Try to open the KDE Download Manager (KGet) and if it fails open the Firefox internal download manager
    if (openKDEDownloadManager())
      return;
  }

EOL
  LASTLINES=`expr $NUMLINES - $MATCHINGLINE - 1`
  tail -n $LASTLINES $PATCHINGFILE >>$PATCHINGFILE.tmp
  mv -f $PATCHINGFILE.tmp $PATCHINGFILE
fi
  
  
# Add openKDEDownloadManager()
cat >>$PATCHINGFILE <<EOL

function openKDEDownloadManager()
{
	var command = "/bin/bash";
	var args = new Array();
	args.push ("-c");
	args.push ("kget && dcop kget 'kget mainwindow' restore");

	try {
		var applicFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		var applic = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
		applicFile.initWithPath(command);
		if (! applicFile.exists()) {
			return false;
		} else {
			applic.init(applicFile);
			applic.run(false, args, args.length);
		}
	} catch (e) {
		return false;
	}
	return true;
}
EOL



# Repackaging comm.jar
echo "Repackaging $JARFILE"
rm -f $JARFILE
cd $TEMPORARYDIR
zip -r -q $JARFILE *
cd -

# Deleting temporary files
echo "Deleting temporary files in $TEMPORARYDIR"
#rm -Rf $TEMPORARYDIR

# Done
echo "Done"
echo

if [ $ISMOZILLA ]; then
  echo "Make sure you select the option to use a download manager in the preferences of"
  echo "Mozilla or else it will show a download progress window instead of opening KGet."
fi

echo "Don't forget to visit the Mozillux website. Enjoy!"
