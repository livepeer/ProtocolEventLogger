# livepeer-event-loader

Livepeer Event Loader for Livepeer Blockchain protocol. It will fetch the blockchain events from an input {fromBlock:} (optional) to currentBlock. By default it will fetch events from last 3000 blocks.

# Pre requisites

You will require a MongoDB instance. Please make sure you have a local instance of mongodb running else set your preferred mongo URI. In the 'config' folder, create a file dev.js and write the following -

```
module.exports = {
  mongoURI:'' //set your URI here
};
```

# Usage

```
git clone https://github.com/livepeer/ProtocolEventLogger.git
```

`npm install`

## Commands

To get current block number
`./index.js currentblock`

To load all the events in the database.
`./index.js load`

To start the Livepeer service that will store future events in database.
`./index.js startservice`

To stop the Livepeer Service
`./index.js stopservice`

For help
`./index.js --help`
