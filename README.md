appjs-platform
==============

appjs install that is able to serve multiple packaged applications

Install
----

First download and extract the vanilla appjs [distribution for your platform](http://appjs.org/#download). Then
download and extract [appjs-platform](https://github.com/sihorton/appjs-platform/zipball/master) into a folder on your desktop.
Copy the data directory over the top of the data folder in the vanilla appjs folder from the distribution. 
This will update the app.js script, add a packagedApp2.js router for reading packaged applications and also add some modules
for working with packaged applications. If running on windows then also copy app.exe over the built in app.exe if you want 
to be able to use file associations.

Running Packaged applications: Windows 7
-----
To run packaged applications on windows you need to create a file association. Click on one of the example apps in the 
apps directory (e.g. helloWorld.appjs). Windows will open a dialog saying "windows can't open this file", click the second 
option "Select a program from a list of installed programs", click browse and then navigate to the app.exe program in the appjs 
directory and then click ok. When you now click on a packaged application file it will automatically open and run the program.

Running Packaged applications: other os
-----
As a general instruction right click on a .appjs application file and then choose to open it with the app.exe or app.sh script.
Select that script / exe as the default way to open the file type and the OS will then automatically run AppJS for you.

Creating Packaged applications
-----

First develop a working appjs application using the normal appjs layout. When you are happy then the 
[appjs-appPackager](https://github.com/sihorton/appjs-appPackager) project provides a command line tool to create a 
packaged application from a normal appjs application.

