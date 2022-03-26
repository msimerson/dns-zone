# dns-zone-validator

DNS zone validator


## SYNOPSIS

DNS zones have numerous rules regarding the records that can exist in them. Examples:

- serial numbers must increment when changes are made
- multiple identical RRs are not allowed - RFC 2181
    - CAA takes tag into account, SRV: port
- multiple CNAMES with the same name are not allowed
- CNAME cannot coexist with SIG,NXT,KEY,RRSIG,NSEC,A,AAAA
- MX and NS records cannot point to CNAME

Etc, etc, etc..

This module will input a collection of [dns-resource-records](https://github.com/msimerson/dns-resource-record) and validate that all the zone records can coexist.


## BIN/IMPORT

#### show help

````
➜ dns-zone-validator ✗ ./bin/import.js -h

 +-+-+-+ +-+-+-+-+
 |D|N|S| |Z|O|N|E|
 +-+-+-+ +-+-+-+-+

I/O

  -i, --import <stdin | file path>            source of DNS zone data (default: stdin) 
  -e, --export <js | json | bind | tinydns>   zone data export format (default: js)    

Zone Settings

  -o, --origin string   zone $ORIGIN             
  -t, --ttl number      zone default TTL         
  -c, --class string    zone class (default: IN) 

Output Options

  --hide-origin    remove origin from RR domain names (default: false) 
  --hide-class     hide class (default: false)                         
  --hide-ttl       hide TTLs (default: false)                          

Misc

  -v, --verbose    Show status messages during processing 
  -h, --help       Display this usage guide               

Examples

  1. BIND file to tinydns      ./bin/import -i ./isi.edu -e tinydns 
  2. BIND file to JS objects   ./bin/import -i ./isi.edu            
  3. tinydns file to BIND      ./bin/import -i ./data -e bind       

  Project home: https://github.com/msimerson/dns-zone-validator 
````


#### import from STDIN to JS

````
➜ cat example.com | ./bin/import.js --origin=example.com
[
  SOA(12) [Map] {
    'name' => 'example.com.',
    'ttl' => 3600,
    'class' => 'IN',
    'type' => 'SOA',
    'mname' => 'ns.example.com.',
    'rname' => 'username.example.com.',
    'serial' => 2020091025,
    'refresh' => 7200,
    'retry' => 3600,
    'expire' => 1209600,
    'minimum' => 3600,
    'comment' => { serial: '', refresh: '', retry: '', expire: '', minimum: '' }
  },
  NS(5) [Map] {
    'name' => 'example.com.',
    'ttl' => 3600,
    'class' => 'IN',
    'type' => 'NS',
    'dname' => 'ns.example.com.'
  },
...<snip>...
  A(5) [Map] {
    'name' => 'mail3.example.com.',
    'ttl' => 3600,
    'class' => 'IN',
    'type' => 'A',
    'address' => '192.0.2.5'
  }
]
````

#### from bind file to bind

````
➜ ./bin/import.js -i isi.edu -e bind
$TTL    60
$ORIGIN isi.edu.
isi.edu.    IN  SOA venera.isi.edu. action.domains.isi.edu. (
          20     ; SERIAL
          7200   ; REFRESH
          600    ; RETRY
          3600000; EXPIRE
          60
          )

isi.edu.    60  IN  NS  A.ISI.EDU.
isi.edu.    60  IN  NS  venera.isi.edu.
isi.edu.    60  IN  NS  vaxa.isi.edu.
isi.edu.    60  IN  MX  10  venera.isi.edu.
isi.edu.    60  IN  MX  20  vaxa.isi.edu.
a   60  IN  A   26.3.0.103
venera  60  IN  A   10.1.0.52
venera  60  IN  A   128.9.0.32
vaxa    60  IN  A   10.2.0.27
vaxa    60  IN  A   128.9.0.33
````

#### from bind to bind (relative)

````
➜ ./bin/import.js -i isi.edu -e bind --ttl=60 --hide-ttl --hide-class --hide-origin
$TTL  60
$ORIGIN isi.edu.
@ IN  SOA venera  action.domains (
    20     ; SERIAL
    7200   ; REFRESH
    600    ; RETRY
    3600000; EXPIRE
    60
    )

@     NS  a
@     NS  venera
@     NS  vaxa
@     MX  10  venera
@     MX  20  vaxa
a     A 26.3.0.103
venera      A 10.1.0.52
venera      A 128.9.0.32
vaxa      A 10.2.0.27
vaxa      A 128.9.0.33
````


#### from bind to tinydns

````
➜  ./bin/import.js -i isi.edu -e tinydns
Zisi.edu:venera.isi.edu:action.domains.isi.edu:20:7200:600:3600000:60:60::
&isi.edu::A.ISI.EDU:60::
&isi.edu::venera.isi.edu:60::
&isi.edu::vaxa.isi.edu:60::
@isi.edu::venera.isi.edu:10:60::
@isi.edu::vaxa.isi.edu:20:60::
+a.isi.edu:26.3.0.103:60::
+venera.isi.edu:10.1.0.52:60::
+venera.isi.edu:128.9.0.32:60::
+vaxa.isi.edu:10.2.0.27:60::
+vaxa.isi.edu:128.9.0.33:60::
````

## TODO

- importing
    - [ ] write a named.conf file parser
    - [x] write a bind zone file parser
    - [x] write a tinydns data file parser
    - [ ] add BIND parsing for all RRs supported by dns-rr
    - [ ] add support for $INCLUDE (RFC 1035)
- normalize BIND zone records
    - [x] expand `@` to zone name
    - [x] empty names are same as previous RR record
    - [x] missing TTLs inherit zone TTL, or zone MINIMUM
    - expand hostnames to FQDNs
        - [x] ALL: name field
        - [x] MX: exchange
        - [x] CNAME: cname,
        - [x] SOA: mname, rname,
        - [x] NS,PTR: dname
    - [x] suppress hostname when identical to previous RR
- [ ] validate zone rules
