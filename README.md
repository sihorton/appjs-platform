appjs-platform
==============

appjs patch to support running packaged applications

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

Tips
------
To enable the same app.js code to run both inside and outside of a package add the following rows of code as the first 
lines of your script:

    if (!app) {
      var app = module.exports = require("appjs");
      app.serveFilesFrom(__dirname + "/content");
    }

To read a file from app.js that is part of the application you can use the app.readPackageFile, this will work if you are 
running from a directory or running from inside a package:

    app.readPackageFile("packageFile.txt", function(err,buffer) {
        if (err) throw err;
        console.log(buffer.toString());
    }

An example application "writeLogReadPackageFile" is provided to demonstrate a working example.

Node Modules
-------------

It is important to note that the current implementation does not handle node modules at all. If your application requires
certain node modules to be available then you will need to copy them to the users appjs-platform folder. We will probably
add some form of support for modules in the future. In general javascript modules should not be a problem, but C++ modules
will have to be selected based upon the platform that appjs is installed on.



Why do this?
---------

Well currently if you want to distribute apps to others then a common way is to distribute the vanilla appjs download with your application files replacing the content directory. However this adds more than 20 Meg of overhead. If you now want to push out an update to the application then the user has to download that 20+ Meg file again. The idea of the patch is to get the user to install the "runtime" once. Then you can send them as many apps and updates as you like with the application only being the size of your content.

Once you have the runtime you can copy .appjs files anywhere on your computer / network / usb stick and simply clicking on the file will launch AppJS and run the application.

How does it actually work?
-------

All that is going on is that all of the content files for your application including the app.js file are appended into a single file. A new router has been written that can translate "http://appjs/myPackageFile.txt" into a location in the package file, extract the file contents and then send the file to the application. In this way it works transparently to the developer / user. There is also an app.readPackageFile() function that lets you read files from the package at runtime, this works transparently if you are running from a normal directory or from inside a packaged application. The .appjs file is not compressed at all so that it will have high performance on slower machines (running from a package adds minimal overhead).
