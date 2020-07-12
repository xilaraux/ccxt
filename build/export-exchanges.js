// ----------------------------------------------------------------------------
// Usage:
//
//      npm run export-exchanges
// ----------------------------------------------------------------------------

"use strict";

const fs        = require ('fs')
    , countries = require ('./countries')
    , asTable   = require ('as-table').configure ({
        delimiter: '|',
        print: x => ' ' + x + ' '
    })
    , execSync  = require ('child_process').execSync
    , log       = require ('ololog').unlimited
    , ansi      = require ('ansicolor').nice
    , { keys, values, entries } = Object
    , { replaceInFile } = require ('./fs.js')

// ----------------------------------------------------------------------------

function cloneGitHubWiki (gitWikiPath) {

    if (!fs.existsSync (gitWikiPath)) {
        log.bright.cyan ('Cloning ccxt.wiki...')
        execSync ('git clone https://github.com/ccxt/ccxt.wiki.git ' + gitWikiPath)
    }
}

// ----------------------------------------------------------------------------

function logExportExchanges (filename, regex, replacement) {
    log.bright.cyan ('Exporting exchanges →', filename.yellow)
    replaceInFile (filename, regex, replacement)
}

// ----------------------------------------------------------------------------

function getIncludedExchangeIds () {

    const includedIds = fs.readFileSync ('exchanges.cfg')
        .toString () // Buffer → String
        .split ('\n') // String → Array
        .map (line => line.split ('#')[0].trim ()) // trim comments
        .filter (exchange => exchange); // filter empty lines

    const isIncluded = (id) => ((includedIds.length === 0) || includedIds.includes (id))

    const ids = fs.readdirSync ('./js/')
        .filter (file => file.match (/[a-zA-Z0-9_-]+.js$/))
        .map (file => file.slice (0, -3))
        .filter (isIncluded);

    return ids
}

// ----------------------------------------------------------------------------

function exportExchanges (replacements) {

    log.bright.yellow ('Exporting exchanges...')

    replacements.forEach (({ file, regex, replacement }) => {
        logExportExchanges (file, regex, replacement)
    })

    log.bright.green ('Base sources updated successfully.')
}

// ----------------------------------------------------------------------------

function createExchanges (ids) {

    const ccxt = require ('../ccxt.js')

    const createExchange = (id) => {
        ccxt[id].prototype.checkRequiredDependencies = () => {} // suppress it
        return new (ccxt)[id] ()
    }

    return ccxt.indexBy (ids.map (createExchange), 'id')
}

// ----------------------------------------------------------------------------

const ccxtCertifiedBadge = '[![CCXT Certified](https://img.shields.io/badge/CCXT-Certified-green.svg)](https://github.com/ccxt/ccxt/wiki/Certification)'
    , ccxtProBadge = '[![CCXT Pro](https://img.shields.io/badge/CCXT-Pro-black)](https://ccxt.pro)'

function createMarkdownListOfExchanges (exchanges, paths) {

    return exchanges.map ((exchange) => {
        const logo = exchange.urls['logo']
        const www = exchange.urls.www
        const url = exchange.urls.referral || www
        const doc = Array.isArray (exchange.urls.doc) ? exchange.urls.doc[0] : exchange.urls.doc
        const version = exchange.version ? exchange.version.replace (/[^0-9\.]+/, '') : '\*'
        return {
            'logo': '[![' + exchange.id + '](' + logo + ')](' + url + ')',
            'id': exchange.id,
            'name': '[' + exchange.name + '](' + url + ')',
            'ver': version,
            'doc': '[API](' + doc + ')',
            'certified': exchange.certified ? ccxtCertifiedBadge : '',
            'pro': exchange.pro ? ccxtProBadge : '',
        }
    })
}

function createMarkdownTable (array) {
    const table = asTable (array)
    const lines = table.split ("\n")
    //
    // asTable creates a header underline like
    //
    //      logo | id | name | ver | doc | certified | pro
    //     ------------------------------------------------
    //
    // we fix it to match markdown underline like
    //
    //      logo | id | name | ver | doc | certified | pro
    //     ------|----|------|-----|-----|-----------|-----
    //
    const underline = lines[0].replace (/[^\|]/g, '-')
    lines.splice (1, 1, underline)
    //
    // ver and doc columns should be centered so we convert it to
    //
    //      logo | id | name | ver | doc | certified | pro
    //     ------|----|------|:---:|:---:|-----------|-----
    //
    const columns = underline.split ('|')
    columns[3] = ':' + columns[3].slice (1, columns[3].length - 1) + ':'
    columns[4] = ':' + columns[4].slice (1, columns[4].length - 1) + ':'
    lines.splice (1, 1, columns.join ('|'))
    //
    // prepend and append a vertical bar to each line
    //
    //     | logo | id | name | ver | doc | certified | pro |
    //     |------|----|------|:---:|:---:|-----------|-----|
    //
    return lines.map (line => '|' + line + '|').join ("\n")
}

// ----------------------------------------------------------------------------
// TODO: REWRITE THIS ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓

function exportSupportedAndCertifiedExchanges (exchanges, { allExchangesPaths, certifiedExchangesPaths, exchangesByCountriesPaths, proExchangesPaths }) {

    // ............................................................................
    // markup constants and helper functions

    const countryName = (code) => countries[code] || code

    const logoHeading = '&nbsp;'.repeat (7) + 'logo' + '&nbsp;'.repeat (7)
    const tableHeadings = [ logoHeading, 'id', 'name', 'ver', 'doc', 'certified', 'pro' ]
    const exchangesByCountryHeading = [ 'country / region', ... tableHeadings.slice (0, 5) ]

    // ----------------------------------------------------------------------------
    // list all supported exchanges

    const exchangesNotListedInDocs = [ 'hitbtc2' ]

    function makeTable (jsonArray) {
        let table = asTable (jsonArray)
        let lines = table.split ("\n")
        lines.splice (1,0, lines[0].replace (/[^\|]/g, '-'))
        let headerLine = lines[1].split ('|')
        headerLine[3] = ':' + headerLine[3].slice (1, headerLine[3].length - 1) + ':'
        headerLine[4] = ':' + headerLine[4].slice (1, headerLine[4].length - 1) + ':'
        lines[1] = headerLine.join ('|')
        return lines.map (line => '|' + line + '|').join ("\n")
    }

    const arrayOfExchanges = values (exchanges)

    if (allExchangesPaths) {

        const markdownListOfSupportedExchanges = createMarkdownListOfExchanges (arrayOfExchanges)
            , supportedExchangesMarkdownTable = createMarkdownTable (markdownListOfSupportedExchanges)
            , numExchanges = arrayOfExchanges.length
            , beginning = "The CCXT library currently supports the following "
            , ending = " cryptocurrency exchange markets and trading APIs:\n\n"
            , totalString = beginning + numExchanges + ending
            , allExchangesReplacement = totalString + supportedExchangesMarkdownTable + "$1"
            , allExchangesRegex = new RegExp ("[^\n]+[\n]{2}\\|[^`]+\\|([\n][\n]|[\n]$|$)", 'm')

        for (const path of allExchangesPaths) {
            logExportExchanges (path, allExchangesRegex, allExchangesReplacement)
        }
    }

    if (proExchangesPaths) {

        const proExchanges = arrayOfExchanges.filter (exchange => exchange.pro)
            , markdownListOfProExchanges = createMarkdownListOfExchanges (proExchanges)
            , proExchangesMarkdownTable = createMarkdownTable (markdownListOfProExchanges)
            , numExchanges = proExchanges.length
            , beginning = "The CCXT Pro library currently supports the following "
            , ending = " cryptocurrency exchange markets and WebSocket trading APIs:\n\n"
            , totalString = beginning + numExchanges + ending
            , proExchangesReplacement = totalString + proExchangesMarkdownTable + "$1"
            , proExchangesRegex = new RegExp ("[^\n]+[\n]{2}\\|[^`]+\\|([\n][\n]|[\n]$|$)", 'm')

        for (const path of proExchangesPaths) {
            logExportExchanges (path, proExchangesRegex, proExchangesReplacement)
        }
    }

    if (certifiedExchangesPaths) {
            const certifiedExchanges = arrayOfExchanges.filter (exchange => exchange.certified)
                , markdownListOfCertifiedExchanges = createMarkdownListOfExchanges (certifiedExchanges)
                , certifiedExchangesMarkdownTable = createMarkdownTable (markdownListOfCertifiedExchanges)
                , certifiedExchangesReplacement = '$1' + certifiedExchangesMarkdownTable + "\n"
                , certifiedExchangesRegex = new RegExp ("^(## Certified Cryptocurrency Exchanges\n{3})(?:\\|.+\\|$\n)+", 'm')

        for (const path of certifiedExchangesPaths) {
            logExportExchanges (path, certifiedExchangesRegex, certifiedExchangesReplacement)
        }

        // logExportExchanges ('README.md', certifiedExchangesRegex, certifiedExchanges)
    }

    if (exchangesByCountriesPaths) {
        let exchangesByCountries = []
        keys (countries).forEach (code => {
            let country = countries[code]
            let result = []
            keys (exchanges).forEach (id => {
                let exchange = exchanges[id]
                let logo = exchange.urls['logo']
                let website = Array.isArray (exchange.urls.www) ? exchange.urls.www[0] : exchange.urls.www
                let url = exchange.urls.referral || website
                let doc = Array.isArray (exchange.urls.doc) ? exchange.urls.doc[0] : exchange.urls.doc
                let version = exchange.version ? exchange.version : '\*'
                let matches = version.match (/[^0-9]*([0-9].*)/)
                if (matches)
                    version = matches[1];
                let shouldInclude = false
                if (Array.isArray (exchange.countries)) {
                    if (exchange.countries.indexOf (code) > -1)
                        shouldInclude = true
                } else {
                    if (code == exchange.countries)
                        shouldInclude = true
                }
                if (shouldInclude) {
                    let entry = [
                        country,
                        '[![' + exchange.id + '](' + logo + ')](' + url + ')',
                        exchange.id,
                        '[' + exchange.name + '](' + url + ')',
                        version,
                        '[API](' + doc + ')',
                        // doesn't fit in width
                        // exchange.certified ? ccxtCertifiedBadge : '',
                    ]
                    result.push (entry)
                }
            })
            exchangesByCountries = exchangesByCountries.concat (result)
        });

        const countryKeyIndex = exchangesByCountryHeading.indexOf ('country / region')
        exchangesByCountries = exchangesByCountries.sort ((a, b) => {
            const countryA = a[countryKeyIndex].toLowerCase ()
            const countryB = b[countryKeyIndex].toLowerCase ()
            if (countryA > countryB) {
                return 1
            } else if (countryA < countryB) {
                return -1;
            } else {
                if (a['id'] > b['id'])
                    return 1;
                else if (a['id'] < b['id'])
                    return -1;
                else
                    return 0;
            }
        })

        exchangesByCountries.splice (0, 0, exchangesByCountryHeading)
        const lines = makeTable (exchangesByCountries)
        const result = "# Exchanges By Country\n\nThe ccxt library currently supports the following cryptocurrency exchange markets and trading APIs:\n\n" + lines + "\n\n"
        for (const path of exchangesByCountriesPaths) {
            fs.truncateSync (path)
            fs.writeFileSync (path, result)
        }
    }
}

// TODO: REWRITE THIS ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
// ----------------------------------------------------------------------------

function exportExchangeIdsToExchangesJson (exchanges) {
    log.bright ('Exporting exchange ids to'.cyan, 'exchanges.json'.yellow)
    const ids = keys (exchanges)
    console.log (ids)
    fs.writeFileSync ('exchanges.json', JSON.stringify ({ ids }, null, 4))
}

// ----------------------------------------------------------------------------

function exportWikiToGitHub (wikiPath, gitWikiPath) {

    log.bright.cyan ('Exporting wiki to GitHub')

    const ccxtWikiFiles = {
        'README.md': 'Home.md',
        'Install.md': 'Install.md',
        'Manual.md': 'Manual.md',
        'Exchange-Markets.md': 'Exchange-Markets.md',
        'Exchange-Markets-By-Country.md': 'Exchange-Markets-By-Country.md',
        'ccxt.pro.md': 'ccxt.pro.md',
        'ccxt.pro.install.md': 'ccxt.pro.install.md',
        'ccxt.pro.manual.md': 'ccxt.pro.manual.md',
    }

    for (const [ sourceFile, destinationFile ] of entries (ccxtWikiFiles)) {

        const sourcePath = wikiPath + '/' + sourceFile
        const destinationPath = gitWikiPath + '/' + destinationFile
        log.bright.cyan ('Exporting', sourcePath.yellow, '→', destinationPath.yellow)
        fs.writeFileSync (destinationPath, fs.readFileSync (sourcePath))
    }
}

// ----------------------------------------------------------------------------

function exportKeywordsToPackageJson (exchanges) {

    log.bright ('Exporting exchange keywords to'.cyan, 'package.json'.yellow)

    // const packageJSON = require ('../package.json')
    const packageJSON = JSON.parse (fs.readFileSync ('./package.json'))
    const keywords = new Set (packageJSON.keywords)

    for (const ex of values (exchanges)) {
        for (const url of Array.isArray (ex.urls.www) ? ex.urls.www : [ex.urls.www]) {
            keywords.add (url.replace (/(http|https):\/\/(www\.)?/, '').replace (/\/.*/, ''))
        }
        keywords.add (ex.name)
    }

    packageJSON.keywords = [...keywords]
    fs.writeFileSync ('./package.json', JSON.stringify (packageJSON, null, 2) + "\n")
}

// ----------------------------------------------------------------------------

function flatten (nested, result = []) {
    for (const key in nested) {
        result.push (key)
        if (Object.keys (nested[key]).length)
            flatten (nested[key], result)
    }
    return result
}

// ----------------------------------------------------------------------------

function exportEverything () {
    const ids = getIncludedExchangeIds ()
    const errorHierarchy = require ('../js/base/errorHierarchy.js')
    const flat = flatten (errorHierarchy)
    flat.push ('error_hierarchy')

    const replacements = [
        {
            file: './ccxt.js',
            regex:  /(?:const|var)\s+exchanges\s+\=\s+\{[^\}]+\}/,
            replacement: "const exchanges = {\n" + ids.map (id => ("    '" + id + "':").padEnd (30) + " require ('./js/" + id + ".js'),").join ("\n") + "    \n}",
        },
        {
            file: './python/ccxt/__init__.py',
            regex: /exchanges \= \[[^\]]+\]/,
            replacement: "exchanges = [\n" + "    '" + ids.join ("',\n    '") + "'," + "\n]",
        },
        {
            file: './python/ccxt/__init__.py',
            regex: /(?:from ccxt\.[^\.]+ import [^\s]+\s+\# noqa\: F401[\r]?[\n])+[\r]?[\n]exchanges/,
            replacement: ids.map (id => ('from ccxt.' + id + ' import ' + id).padEnd (60) + '# noqa: F401').join ("\n") + "\n\nexchanges",
        },
        {
            file: './python/ccxt/__init__.py',
            regex: /(?:from ccxt\.base\.errors import [^\s]+\s+\# noqa\: F401[\r]?[\n])+[\r]?[\n]/,
            replacement: flat.map (error => ('from ccxt.base.errors' + ' import ' + error).padEnd (60) + '# noqa: F401').join ("\n") + "\n\n",
        },
        {
            file: './python/ccxt/async_support/__init__.py',
            regex: /(?:from ccxt\.base\.errors import [^\s]+\s+\# noqa\: F401[\r]?[\n])+[\r]?[\n]/,
            replacement: flat.map (error => ('from ccxt.base.errors' + ' import ' + error).padEnd (60) + '# noqa: F401').join ("\n") + "\n\n",
        },
        {
            file: './python/ccxt/async_support/__init__.py',
            regex: /(?:from ccxt\.async_support\.[^\.]+ import [^\s]+\s+\# noqa\: F401[\r]?[\n])+[\r]?[\n]exchanges/,
            replacement: ids.map (id => ('from ccxt.async_support.' + id + ' import ' + id).padEnd (74) + '# noqa: F401').join ("\n") + "\n\nexchanges",
        },
        {
            file: './python/ccxt/async_support/__init__.py',
            regex: /exchanges \= \[[^\]]+\]/,
            replacement: "exchanges = [\n" + "    '" + ids.join ("',\n    '") + "'," + "\n]",
        },
        {
            file: './php/base/Exchange.php',
            regex: /public static \$exchanges \= array\s*\([^\)]+\)/,
            replacement: "public static $exchanges = array(\n        '" + ids.join ("',\n        '") + "',\n    )",
        },
    ]

    exportExchanges (replacements)

    // strategically placed exactly here (we can require it AFTER the export)
    const exchanges = createExchanges (ids)

    const wikiPath = 'wiki'
        , gitWikiPath = 'build/ccxt.wiki'

    cloneGitHubWiki (gitWikiPath)

    exportSupportedAndCertifiedExchanges (exchanges, {
        allExchangesPaths: [
            'README.md',
            wikiPath + '/Manual.md',
            wikiPath + '/Exchange-Markets.md'
        ],
        certifiedExchangesPaths: [
            'README.md',
        ],
        exchangesByCountriesPaths: [
            wikiPath + '/Exchange-Markets-By-Country.md'
        ],
        proExchangesPaths: [
            wikiPath + '/ccxt.pro.manual.md',
        ],
    })

    exportExchangeIdsToExchangesJson (exchanges)
    exportWikiToGitHub (wikiPath, gitWikiPath)
    exportKeywordsToPackageJson (exchanges)

    log.bright.green ('Exported successfully.')
}

// ============================================================================
// main entry point

if (require.main === module) {

    // if called directly like `node module`

    exportEverything ()

} else {

    // do nothing if required as a module
}

// ============================================================================

module.exports = {
    cloneGitHubWiki,
    getIncludedExchangeIds,
    exportExchanges,
    createExchanges,
    exportSupportedAndCertifiedExchanges,
    exportExchangeIdsToExchangesJson,
    exportWikiToGitHub,
    exportKeywordsToPackageJson,
    exportEverything,
}
