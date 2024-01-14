const express = require("express");
const app = express();
const port = 3000;
const axios = require("axios");
const { ethers } = require("ethers");

require("dotenv").config();
app.use(express.json());

const baseURL = process.env.BASE_URL; // https://bridge-api.public.zkevm-test.net
const ISMAddress = process.env.ISM_ADDRESS; // 0x22D0Cc772C6e87e6A952b675BB128CCF97B1A2d6

const mekrleProofString = "/merkle-proof";
const getClaimsFromAcc = "/bridges/";

const functionAbi = [
  {
    type: "bytes32[32]",
    name: "smtProof",
  },
  {
    type: "uint32",
    name: "index",
  },
  {
    type: "bytes32",
    name: "mainnetExitRoot",
  },
  {
    type: "bytes32",
    name: "rollupExitRoot",
  },
  {
    type: "uint32",
    name: "originNetwork",
  },
  {
    type: "address",
    name: "originAddress",
  },
  {
    type: "uint32",
    name: "destinationNetwork",
  },
  {
    type: "address",
    name: "destinationAddress",
  },
  {
    type: "uint256",
    name: "amount",
  },
  {
    type: "bytes",
    name: "metadata",
  },
];

app.post("/", async (req, res) => {
  try {
    const { data, sender } = req.body;

    const PolygonData = (
      await axios.get(baseURL + getClaimsFromAcc + ISMAddress)
    ).data;

    const matchedDeposit = PolygonData.deposits.find(
      (deposit) => deposit.metadata === data
    );
    console.log("Matched Deposit:", PolygonData, matchedDeposit);
    if (!matchedDeposit) {
      res.status(404).send({ error: "Deposit not found" });
      return;
    }
    if (!matchedDeposit.ready_for_claim) {
      res.status(503).send({ error: "Deposit not ready for claim" });
      return;
    }

    if (matchedDeposit.claim_tx_hash) {
      res.status(503).send({ error: "Deposit already claimed" });
      return;
    }

    const proof = (
      await axios.get(baseURL + mekrleProofString, {
        params: {
          deposit_cnt: matchedDeposit.deposit_cnt,
          net_id: matchedDeposit.orig_net,
        },
      })
    ).data.proof;
    const encodedABI = ethers.AbiCoder.defaultAbiCoder().encode(functionAbi, [
      proof.merkle_proof,
      matchedDeposit.deposit_cnt,
      proof.main_exit_root,
      proof.rollup_exit_root,
      matchedDeposit.orig_net,
      matchedDeposit.orig_addr,
      matchedDeposit.dest_net,
      matchedDeposit.dest_addr,
      matchedDeposit.amount,
      matchedDeposit.metadata,
    ]);

    console.log("Encoded ABI:", encodedABI);
    res.send({ data: encodedABI });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
