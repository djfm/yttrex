The format is based on [Keep a Changelog](http://keepachangelog.com/) and this
project adheres to [Semantic Versioning](http://semver.org/).

## [1.6.6] - 2021-10-22
### Added
- supporting offset
- MutationObserver
- remoteLookup
- experiment local file reading 
### Fixed
- useless selector removed

## [1.4.3] - 2020-06-25
### Fixed
- Building scripts, got inputs from extension reviewers. 
### Bug
- manifest.json and package.json still will report 1.4.2

## [1.4.2] - 2020-06-20
### Fixed
- Links in infoBox.js weren't correct
- Lack of lodash include was preventing a certain condition to work

## [1.4.1] - 2020-06-08
### Fixed
- Privacy improvement by removing 'tabs' as unnecessary privilege
- Fixed link generation

## [1.4.0] - 2020-06-07
### Added
- New HTML element watchers, integrated real-time event API
- New Popup design and functionality
### Fixed
- Popup content and links, material-ui updated to 4.x

## [1.3.0] - 2020-03-30
### Added
- New UX (traffic light)
### Defined 
- [browser-extention issue list](https://github.com/tracking-exposed/yttrex/labels/browser-extention)
### Fixed
- Frequency and internal timing

## [1.2.1] - 2019-10-19
### Added
- Random identifier to recognize same video even when duplicated
### Fixed
- testElement awaits HTML as parameter

## [1.2.0] - 2019-10-19
### Fixed 
- Restored the personal URL, in the popup
- Visual feedback on acquiring content
- Acquired advertising elements

## [1.1.6] - 2019-01-08
### Removed
- Removed the build process is not anymore working only in git repos

## [1.1.5] - 2018-11-07
### Removed
- Uglify and minify, I'm tired of Mozilla rejecting the pkg

## [1.1.4] - 2018-11-06
### Removed
- Autoplay function

## [1.1.0] - 2018-10-23
### Added
- Implemented replay function
- Implemented commitment declaration

## [1.0.2] - 2018-09-18
### Fixed
- Changed the personal API to access via publicKey

## [1.0.1] - 2018-09-15
### Added
- Make actually work the extention and ready to be published

## [1.0.0] - 2018-07-31
### Added
- Create first release of the extension
