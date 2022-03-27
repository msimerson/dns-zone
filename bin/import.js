#!node

const fs   = require('fs')
const path = require('path')
const os   = require('os')

const chalk = require('chalk')
const cmdLineArgs = require('command-line-args')
const cmdLineUsage = require('command-line-usage')

const zf      = require('../lib/zonefile')
const tinydns = require('../lib/tinydns')
const RR      = require('dns-resource-record')
const rr      = new RR.A(null)

// CLI argument processing
const opts = cmdLineArgs(usageOptions())._all
if (opts.verbose) console.error(opts)
if (opts.help) usage()

const zone_opts = {
  origin: rr.fullyQualify(opts.origin) || '',
  ttl   : opts.ttl || 0,
  class : opts.class || 'IN',
  hide  : {
    class   : opts['hide-class'],
    ttl     : opts['hide-ttl'],
    origin  : opts['hide-origin'],
    sameName: opts['hide-same-name'],
  },
}
if (opts.verbose) console.error(zone_opts)

ingestZoneData()
  .then(r => {
    switch (r.type) {
      case 'tinydns':
        return tinydns.parseData(r.data)
      default:
        zf.zoneOpts = zone_opts
        return zf.parseZoneFile(r.data).then(zf.expandShortcuts)
    }
  })
  .then(output)
  .catch(e => {
    console.error(e.message)
  })


function usage () {
  console.error(cmdLineUsage(usageSections()))
  process.exit(1)
}

function usageOptions () {
  return [
    {
      name        : 'import',
      alias       : 'i',
      defaultValue: 'stdin',
      type        : String,
      typeLabel   : '<stdin | file path>',
      description : 'source of DNS zone data (default: stdin)',
      group       : 'io',
    },
    {
      name        : 'export',
      alias       : 'e',
      defaultValue: 'js',
      type        : String,
      typeLabel   : '<js | json | bind | tinydns>',
      description : 'zone data export format (default: js)',
      group       : 'io',
    },
    {
      name       : 'origin',
      alias       : 'o',
      type       : String,
      description: 'zone $ORIGIN',
      group       : 'main',
    },
    {
      name       : 'ttl',
      alias      : 't',
      type       : Number,
      description: 'zone default TTL',
      group       : 'main',
    },
    {
      name        : 'class',
      alias       : 'c',
      defaultValue: 'IN',
      type        : String,
      description : 'zone class (default: IN)',
      group       : 'main',
    },
    {
      name        : 'hide-origin',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'remove origin from RR domain names (default: false)',
      group       : 'out',
    },
    {
      name        : 'hide-class',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'hide class (default: false)',
      group       : 'out',
    },
    {
      name        : 'hide-ttl',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'hide TTLs (default: false)',
      group       : 'out',
    },
    {
      name        : 'hide-same-name',
      defaultValue: false,
      type        : Boolean,
      description : 'hide name when same as previous RR',
      group       : 'out',
    },
    {
      name       : 'verbose',
      alias      : 'v',
      description: 'Show status messages during processing',
      type       : Boolean,
    },
    {
      name       : 'help',
      description: 'Display this usage guide',
      alias      : 'h',
      type       : Boolean,
    },
  ]
}

function usageSections () {
  return [
    {
      content: chalk.blue(` +-+-+-+ +-+-+-+-+\n |D|N|S| |Z|O|N|E|\n +-+-+-+ +-+-+-+-+`),
      raw    : true,
    },
    {
      header    : 'I/O',
      optionList: usageOptions(),
      group     : 'io',
    },
    {
      header    : 'Zone Settings',
      optionList: usageOptions(),
      group     : 'main',
    },
    {
      header    : 'Output Options',
      optionList: usageOptions(),
      group     : 'out',
    },
    {
      header    : 'Misc',
      optionList: usageOptions(),
      group     : '_none',
    },
    {
      header : 'Examples',
      content: [
        {
          desc   : '1. BIND file to tinydns',
          example: './bin/import -i ./isi.edu -e tinydns',
        },
        {
          desc   : '2. BIND file to JS objects',
          example: './bin/import -i ./isi.edu',
        },
        {
          desc   : '3. tinydns file to BIND',
          example: './bin/import -i ./data -e bind',
        },
      ],
    },
    {
      content: 'Project home: {underline https://github.com/msimerson/dns-zone-validator}',
    },
  ]
}

function ingestZoneData () {
  return new Promise((resolve, reject) => {

    const res = { type: 'bind' }
    if (!opts.import) usage()

    let filePath = opts.import

    if (filePath === 'stdin') {
      filePath = process.stdin.fd
    }
    else if (path.basename(filePath) === 'data'){
      res.type = 'tinydns'
    }
    else {
      if (!opts.origin) zone_opts.origin = rr.fullyQualify(path.basename(filePath))
    }

    if (opts.verbose) console.error(`reading file ${filePath}`)

    fs.readFile(filePath, (err, buf) => {
      if (err) return reject(err)

      res.data = buf.toString()

      resolve(res)
    })
  })
}

function output (zoneArray) {
  // console.error(zoneArray)
  switch (opts.export.toLowerCase()) {
    case 'json'   : return toJSON(zoneArray)
    case 'bind'   : return toBind(zoneArray, zone_opts.origin)
    case 'tinydns': return toTinydns(zoneArray)
    default:
      toHuman(zoneArray)
  }
}

function isBlank (rr) {
  if (rr === os.EOL) {
    process.stdout.write(rr)
    return true
  }
}

function toBind (zoneArray, origin) {
  for (const rr of zoneArray) {
    if (isBlank(rr)) continue
    process.stdout.write(rr.toBind(zone_opts))
    zone_opts.previousName = rr.get('name')
  }
}

function toTinydns (zoneArray) {
  for (const rr of zoneArray) {
    if (rr === os.EOL) continue
    process.stdout.write(rr.toTinydns())
  }
}

function toJSON (zoneArray) {
  for (const rr of zoneArray) {
    if (isBlank(rr)) continue
    if (rr.get('comment')) rr.delete('comment')
    process.stdout.write(JSON.stringify(Object.fromEntries(rr)))
  }
}

function toHuman (zoneArray) {
  const widest = { name: 0, ttl: 0, type: 0, rdata: 0 }
  const fields = [ 'name', 'ttl', 'type' ]
  zoneArray.map(r => {
    if (r === os.EOL) return
    for (const f of fields) {
      if (getWidth(r.get(f)) > widest[f]) widest[f] = getWidth(r.get(f))
    }
    const rdataLen = r.getRdataFields().map(f => r.get(f)).join(' ').length
    if (rdataLen > widest.rdata) widest.rdata = rdataLen
  })

  // console.log(widest)
  let rdataWidth = process.stdout.columns - widest.name - widest.type - 10
  if (!zone_opts.hide.ttl) rdataWidth -= widest.ttl

  for (const r of zoneArray) {
    if (isBlank(r)) continue

    process.stdout.write(r.get('name').padEnd(widest.name + 2, ' '))

    if (!zone_opts.hide.ttl) {
      process.stdout.write(r.get('ttl').toString().padStart(widest.ttl, ' ') + '  ')
    }

    process.stdout.write(r.get('type').padEnd(widest.type + 2, ' '))

    const rdata = r.getRdataFields().map(f => r.get(f)).join(' ')
    process.stdout.write(rdata.substring(0, rdataWidth))
    if (rdata.length > rdataWidth) process.stdout.write('...')

    process.stdout.write('\n')
  }
}

function getWidth (str) {
  // console.log(str)
  if ('number' === typeof (str)) return str.toString().length
  return str.length
}