# BIG-IP BlueGreen
An iControl LX application and API to distribute traffic between application server pools based on a percentage. The API is implemented in Javascript/NodeJS and runs on a BIG-IP as an [iControl LX](https://clouddocs.f5.com/products/iapp/iapp-lx/tmos-14_0/) application. The user interface is written in [TypeScript](https://www.typescriptlang.org/) and [Angular](https://angular.io/) with [Material](https://material.angular.io/components/select/overview). A simple load test implemented in [Locust](https://locust.io/) (for now).

<img src="images/diagram.png" style="width:900px">


There are 2 methods to configure BIG-IP BlueGreen: 
* Using the user interface
* Using the declarative API

A BlueGreen traffic distribution rule consists of 5 elements:
1. **name** - The name of the BlueGreen declaration. This is used as a unique key for creation, modification and deletion of BlueGreen declarations.

2. **virtualServer** - The full path of the virtual server. There may only be a single BlueGreen traffic distribution rule per virtual server. The full path can consist of a partition followed by virtual server name, or can contain partition name, application name and virtual server name.
  Examples:
    * /Common/VirtualServer
    * /DVWA/Application1/serviceMain (this format is common when using an [Application Services 3](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/) declaration)

3. **distribution** - A decimal value between 0.0 and 1.0 representing the amount of clients to direct to the _Blue_ pool. Think of this value as a percentage, as is expressed this way in the BlueGreen UI. The remainder of the distribution percentage is used to represent the percentage of traffic that will be directed to the _Green_ pool. Example: with a distribution value of 0.2, **20%** of clients will be directed to the pool identified as **bluePool**; the remaining **80%** of clients will be directed to the **greenPool**.

4. **bluePool** - The full path to a pool that typically represents a collection of servers running an _older_ version of an application. The full path of a pool can consist of a partition followed by a pool name, or can contain partition name, application name and pool name.
  Examples:
    * /Common/blue_pool
    * /DVWA/Application1/web_pool (this format is common when using an [Application Services 3](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/) declaration)

5. **greenPool** - The full path to a pool that typically represents a collection of servers running an _newer_ version of an application. The full path of a pool can consist of a partition followed by a pool name, or can contain partition name, application name and pool name.
  Examples:
    * /Common/green_pool
    * /DVWA/Application1/web_pool (this format is common when using an [Application Services 3](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/) declaration)


## Compatibility 
Though not exhaustively tested on all BIG-IP versions, this solution has been reported to work on versions 13.0 - 14.1.

## Installation

### Installation Via BIG-IP UI

1. Download the latest RPM package from the [dist](dist/) directory.

2. To view installed iControl LX Extensions in the BIG-IP GUI you must first enable this functionality. To do this, log in via SSH into the system with an `admin` account and execute `touch /var/config/rest/iapps/enable`. No reboot is required. This will enable the **iApps ‣ Package Management LX** menu:

<img src="images/install-1.png">

2. Upload and install the RPM package on the using the BIG-IP GUI:

    * **Main tab > iApps > Package Management LX > Import**
    * Select the downloaded file and click **Upload**

<img src="images/install-2.png"  style="width:700px">

3. Be sure to see the [known issues list](https://github.com/aknot242/bigip-blue-green/issues) to review any known issues and other important information before you attempt to use BIG-IP BlueGreen.


### Installation Via Command Line

Use [directions](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/userguide/installation.html#installcurl-ref) provided by the Application Services 3 project as a reference to install BIG-IP BlueGreen via cURL. 


## Usage
 
### Limitations
* Since the current implementation uses a form of cookie persistence, the configured Virtual Server must utilize an HTTP Profile. If an HTTP Profile is not set for a Virtual Server, this Virtual Server will not appear in the user interface, and any declarations using this Virtual Server will not be permitted when using the API.
* Virtual servers in custom partitions can only be configured to utilize pools in their own partition, or in the **Common** partition.

### UI
1. Log into a BIG-IP that has BIG-IP BlueGreen installed
2. Navigate to https://bigip-hostname/iapps/bigip-blue-green


### API
* Included is a [Postman collection](BigIpBlueGreen.postman_collection.json) for references to post declarations to BIG-IP BlueGreen. You can download Postman [here](https://www.getpostman.com/downloads/).

* To use the API, you must retrieve a BIG-IP authorization token and include it as a header value in all requests. The token can be retrieved by following the directions as indicated [here](https://devcentral.f5.com/articles/demystifying-icontrol-rest-part-6-token-based-authentication). An example of retrieving the token can also be found in the [Postman collection](BigIpBlueGreen.postman_collection.json) of this project. Once the authorization token has been retrieved, it must be inserted as a value into a header named **X-F5-Auth-Token** for all BlueGreen API requests.
* The API supports **GET**, **POST** and **DELETE** REST methods: 
  * **GET** to retrieve all or specific BlueGreen declarations. 
  * **POST** to create and modify BlueGreen declarations
  * **DELETE** to permanently remove them.

#### Example Operations
* `POST` to `https://<bigip>/mgmt/shared/blue-green/declare` with the following JSON payload will create or modify a BlueGreen declaration:
  ```
  {
      "name": "Sample1",
      "virtualServerFullPath": "/Common/MyVirtualServer",
      "distribution": 0.8,
      "bluePool": "/Common/blue_pool",
      "greenPool": "/Common/green_pool"
  }
  ```
* `GET` request to `https://<bigip>/mgmt/shared/blue-green` will return a list of all BlueGreen declarations

* `GET` request to `https://<bigip>/mgmt/shared/blue-green/<declaration name>` will return a specific BlueGreen declaration

* `DELETE` request to `https://<bigip>/mgmt/shared/blue-green/<declaration name>` will delete a specific BlueGreen declaration


## Screenshots
### User Interface
<img src="images/ui-screenshot-1.png" style="width:900px">

<img src="images/ui-screenshot-2.png" style="width:900px">

### Using the API to POST a declaration using Postman
<img src="images/api-screenshot.png" style="width:800px">

## RPM Package Build
Building the project requires Docker to be installed on the host system. The build script is a bash script that can be invoked from the project root by executing `build/build.sh` in a terminal. Once the build is successful, the RPM and sha256 file can be found in `build/rpmbuild/RPMS/noarch`.

 ## Credits
 - Core load balancing logic based on hoolio's [ratio load balancing using rand function](https://devcentral.f5.com/codeshare/ratio-load-balancing-using-rand-function) implementation
 - Icon based on a rotated version of https://commons.wikimedia.org/wiki/File:Blue_green_cyan_nevit_116.svg
