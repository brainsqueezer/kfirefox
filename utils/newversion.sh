#!/bin/sh
 
$ORIGIN="~/.mozilla/firefox/etupnmbn.default/extensions/kde4@ramonantonio.net"
$DESTINATION="/home/rap/Projects/KFirefox/versions/"
$FILENAME="kde4-0.13.jar"

cd $ORIGIN
zip -r $DESTINATION/$FILENAME *


