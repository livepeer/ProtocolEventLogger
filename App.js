const mongoose = require("mongoose");
const cmd = require("node-cmd");
const replace = require("replace-in-file");
const fs = require("fs");
const keys = require("./config/keys");
require("./models/Events");
const Eth = require("ethjs");
const LivepeerTokenArtifact = require("./etc/LivepeerToken");
const LivepeerTokenFaucetArtifact = require("./etc/LivepeerTokenFaucet");
const ControllerArtifact = require("./etc/Controller");
const JobsManagerArtifact = require("./etc/JobsManager");
const RoundsManagerArtifact = require("./etc/RoundsManager");
const BondingManagerArtifact = require("./etc/BondingManager");
const MinterArtifact = require("./etc/Minter");

const DEFAULTS = {
  controllerAddress: "0xf96d54e490317c557a967abfa5d6e33006be69b3",
  provider: "https://mainnet.infura.io/srFaWg0SlljdJAoClX3B",
  artifacts: {
    LivepeerToken: LivepeerTokenArtifact,
    LivepeerTokenFaucet: LivepeerTokenFaucetArtifact,
    Controller: ControllerArtifact,
    JobsManager: JobsManagerArtifact,
    RoundsManager: RoundsManagerArtifact,
    BondingManager: BondingManagerArtifact,
    Minter: MinterArtifact
  },
  fromBlockNum: 5533907, //Starting block of the LivepeerToken contract
  blockIterator: 10000
};
//Initialize Web3
const Web3 = require("web3");
const rpcURL = DEFAULTS.provider;
const web3 = new Web3(rpcURL);

const contracts = {
  LivepeerToken: null,
  //LivepeerTokenFaucet: null,
  BondingManager: null,
  JobsManager: null,
  RoundsManager: null,
  Minter: null
};

//Create a Controller contract instance
const controllerContract = new web3.eth.Contract(
  DEFAULTS.artifacts.Controller.abi,
  DEFAULTS.controllerAddress
);
const contractAddress = [];
const Event = mongoose.model("events");

//Initiliazing all the contracts
const initContracts = async () => {
  console.log("Initializing Contracts");
  for (const name of Object.keys(contracts)) {
    const hash = Eth.keccak256(name);
    await controllerContract.methods.getContract(hash).call((err, address) => {
      if (err) {
        console.log(`Error in initializing contracts: ${err}`);
        return null;
      }
      contractAddress.push(address);
      console.log(address);
      contracts[name] = new web3.eth.Contract(
        DEFAULTS.artifacts[name].abi,
        address
      );
    });
  }
};

//Get current block number
const getCurrentBlock = async () => {
  console.log(await web3.eth.getBlockNumber());
};

const getAllEventsAndSave = async (fromBlock = DEFAULTS.fromBlockNum) => {
  await initContracts();
  console.log("Contracts Iniliazed!\nStart to fetch and store events...");
  const currentBlock = await web3.eth.getBlockNumber();
  await fs.writeFile("currentBlock.txt", currentBlock, err => {
    if (err) throw err;
    console.log("Current block saved!");
  });
  console.log(`Fetching events from block is ${fromBlock} to ${currentBlock}`);
  //for (const name of Object.keys(contracts)) {
  //Object.keys(contracts).forEach(async name => {
  Object.keys(contracts).map(async name => {
    console.log(`Storing events for ${name}...`);
    let temp = parseInt(fromBlock);
    while (temp <= currentBlock) {
      if (currentBlock < temp + DEFAULTS.blockIterator) {
        await getEventsByContractAndSave(name, temp, currentBlock);
        break;
      } else {
        await getEventsByContractAndSave(
          name,
          temp,
          temp + DEFAULTS.blockIterator
        );
        temp = temp + DEFAULTS.blockIterator;
      }
    }
    console.log("Finished...");
  });
};

//Load events and store in DB
const getEventsByContractAndSave = async (name, fromBlock, currentBlock) => {
  console.log(
    `Fetching from contract
      ${name}, fromBlock: ${fromBlock} to currentBlock: ${currentBlock}`
  );
  const e = await contracts[name].getPastEvents("allEvents", {
    fromBlock: fromBlock,
    toBlock: currentBlock
  });
  e.map(e => {
    const returnValues = e.returnValues;
    let temp = {};
    for (const eventKey of Object.keys(returnValues)) {
      if (eventKey < 9 && eventKey > -1) continue;
      temp[eventKey] = returnValues[eventKey];
    }
    new Event({
      transactionHash: e.transactionHash,
      eventType: e.event,
      blockNumber: e.blockNumber,
      eventData: temp
    })
      .save()
      .catch(err => console.log(err));
  });
};
//Get events and save - To be used by daemon service
const getAllEventsForService = async () => {
  const currentBlock = await web3.eth.getBlockNumber();
  mongoose
    .connect(
      keys.mongoURI,
      {
        useNewUrlParser: true
      }
    )
    .then(console.log("DB connection establised."))
    .catch(err => console.log(err));

  fs.readFile("currentBlock.txt", (err, data) => {
    if (err) throw err;
    fromBlock = parseInt(data) + 1;
  });

  console.log("Current block is at" + currentBlock);
  if (fromBlock === currentBlock) {
    return;
  } else {
    if (contracts.LivepeerToken == null) await initContracts();
    console.log("Contracts Iniliazed!\nStart to fetch and store events...");
    console.log(`Fetching events fromBlock ${fromBlock}  to ${currentBlock}`);
    await Object.keys(contracts).map(async name => {
      console.log(`Storing events for ${name}`);
      await getEventsByContractAndSave(name, fromBlock, currentBlock);
      console.log("Finished...");
    });

    await fs.writeFile("currentBlock.txt", currentBlock, err => {
      if (err) throw err;
      console.log("Current block number saved!");
    });
  }
};

//Configure and starts the daemon service for storing new events since currentBlock
const runService = async () => {
  console.log("Configuring service file. This will require root permission.");
  let livepeerServiceUser;
  let livepeerServiceDir;
  let replaceOptions;
  await cmd.get("pwd", (err, data) => {
    if (err) return console.log(err);
    livepeerServiceDir = data.trim() + "/service/livepeerService.js";
    cmd.get("whoami", (err, data) => {
      if (err) return console.log(err);
      livepeerServiceUser = data;
      cmd.get(
        "cp ./service/livepeerService.service livepeerService.service",
        err => {
          if (err) return console.log(err);
          console.log("Service file created.");
          replaceOptions = {
            files: "livepeerService.service",
            from: [/livepeerServiceUser/g, /livepeerServiceDir/g],
            to: [livepeerServiceUser.trim(), livepeerServiceDir.trim()]
          };

          replace(replaceOptions, err => {
            if (err) return console.error(err);
            console.log(
              "Moving livepeerService.service to /lib/systemd/system/:"
            );
            cmd.get(
              "sudo mv ./livepeerService.service /lib/systemd/system/",
              err => {
                if (err) return console.log(err);
                console.log("Success!!!\nAttempting to start the service...");
                cmd.get(
                  "sudo systemctl daemon-reload && sudo systemctl start livepeerService",
                  err => {
                    if (err) return console.log(err);
                    console.log("Service has started...");
                    console.log(
                      "To verify you may check http://localhost:3001"
                    );
                  }
                );
              }
            );
          });
        }
      );
    });
  });
};

//Stops the daemon service
const stopService = async () => {
  cmd.get("sudo systemctl stop livepeerService", err => {
    if (err) return console.log(err);
    console.log("Livepeer service stopped!");
  });
};

module.exports = {
  initContracts,
  getCurrentBlock,
  getAllEventsAndSave,
  getAllEventsForService,
  runService,
  stopService
};
