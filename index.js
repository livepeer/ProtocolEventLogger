#!/usr/bin/env node

const eventLoader = require("commander"); // For cli commands
const mongoose = require("mongoose");
const keys = require("./config/keys");

const {
  getAllEventsAndSave,
  getCurrentBlock,
  runService,
  stopService
} = require("./App");
const FIRST_BLOCK = 5533907;

eventLoader
  .version("0.0.1", "-v ,--version")
  .description("Livepeer Protocol Event Loader version");

eventLoader
  .command("currentblock")
  .description("Shows the current block number of livepeer protocol.")
  .action(() => {
    getCurrentBlock();
  });

eventLoader
  .command("load [fromBlock]")
  .description(
    "Loads & store the events into DB. Optional parameter {fromBlock:} blocknumber, events will be loaded from this block to current block."
  )
  .action(fromBlock => {
    console.log("Connecting to DB..");
    if (fromBlock < FIRST_BLOCK) {
      console.log(
        "Contract was deployed at block" +
          FIRST_BLOCK +
          " Please enter a value greater than or equal to " +
          FIRST_BLOCK
      );
      return;
    }
    mongoose
      .connect(
        keys.mongoURI,
        { useNewUrlParser: true }
      )
      .then(console.log("DB connection establised."))
      .catch(err => console.log(err));
    if (fromBlock) getAllEventsAndSave(fromBlock);
    else getAllEventsAndSave();
  });
eventLoader
  .command("startservice")
  .description(
    "Starts the livepeer daemon service (this requires root permission)"
  )
  .action(() => {
    runService();
  });
eventLoader
  .command("stopservice")
  .description("Stops the livepeer daemon service.")
  .action(() => {
    stopService();
  });

eventLoader.parse(process.argv);
