var web3 = new Web3(Web3.givenProvider);
var contractInstance;
var address;
var ETH = 1000000000000000000;
$(document).ready(function() {
    window.ethereum.enable().then(function(accounts){
      contractInstance = new web3.eth.Contract(abi, "0xcf02CF3847Cb5A1a900B91f8b5736Dc7C1Dc1eF3", {from: accounts[0]});
      console.log(contractInstance);
      address = accounts[0];
      console.log(address);
      getBalances();
      startEventListeners();
    });
    $("#place_bet_button").click(placeBet);
    $("#deposit_button").click(deposit);
    $("#balance_button").click(getContractBalance);
    $("#cash_out_button").click(cashOutPlayer);
    $("#withdraw_button").click(withdrawAll);

});

function getBalances(){
  getWalletBalance();
  getPlayerBalance();
  getContractBalance();
}

function startEventListeners(){

  contractInstance.events.betPlaced({
    fromBlock: 'latest'
  }, function(error, event){
    //console.log("betPlaced " + JSON.stringify(event));
  })
  .on('data', function(event){
    var json = event.returnValues;
    var winner = json.winner;
    var betAmount = json.betAmount/ETH;
    var payout = json.payout/ETH;
    var playerAddress = json.playerAddress.toLowerCase();
    var msg = " address=" + playerAddress
            + " winner=" + winner
            + " betAmout=" + betAmount
            + " payout=" + payout;
    console.log("betPlaced:" + msg);
    if (winner && playerAddress === address){
      $("#bet_result").text("You Won " + payout + " ETH");
    } else if (playerAddress === address){
      $("#bet_result").text("You Lost " + betAmount + " ETH");
    }
    getBalances();
    $("#place_bet_button").attr('disabled',false);
    $("#cash_out_button").attr('disabled',false);
  })
  .on('changed', function(event){
    // remove event from local database
  })
  .on('error', console.error);

  contractInstance.events.LogNewProvableQuery({
    fromBlock: 'latest'
  }, function(error, event){
      var json = event.returnValues;
      var msg = " description=" + json.description
              + " queryId=" + json.queryId;
      console.log("LogNewProvableQuery: " + msg);
      $("#bet_result").html("Bet placed, waiting for response... <br/>Checking with Oracle...");
  });

  contractInstance.events.generatedRandomNumber({
    fromBlock: 'latest'
  }, function(error, event){
      var json = event.returnValues;
      var msg = " address=" + json.playerAddress
              + " queryId=" + json.queryId
              + " randomNumber=" + json.randomNumber;
      console.log("generatedRandomNumber:" + msg);
      $("#coin").attr('src','coinflip.jpg');
  });

}


function getWalletBalance(){
  web3.eth.getBalance(address).then(function(res){
    console.log("getWalletBalance: " + res/ETH);
    $("#account_balance").text((res/ETH).toFixed(4));
  });
}

function placeBet(){
  var betAmount = $("#bet_input").val();
  var coinFace =  $("#coinface_dropdown").val();
  var config = {
    value: web3.utils.toWei(betAmount, "ether")
  }
  contractInstance.methods.placeBet(coinFace).send(config)
  .on("transactionHash", function(hash){
    console.log("placeBet transactionHash: " + hash);
    $("#coin").attr('src','coinflip.gif');
    $("#bet_result").text("Bet placed, waiting for response...");
    $("#place_bet_button").attr('disabled',true);
    $("#cash_out_button").attr('disabled',true);
  })
  .on("confirmation", function(confirmationNr){
    //console.log("placeBet confirmationNr: " + confirmationNr);
  })
  .on("receipt", function(receipt){
    console.log("placeBet receipt: " + receipt);
  })
  .then(function(res){
    console.log(res);
  });

}

function getContractBalance(){
  contractInstance.methods.getContractBalance().call().then(function(res){
    console.log("getContractBalance: " +res);
    $("#contract_balance").text((res/ETH).toFixed(4));
  });
}

function getPlayerBalance(){
  contractInstance.methods.getPlayerBalance().call().then(function(res){
    console.log("getPlayerBalance: " + res);
    $("#player_balance").text((res/ETH).toFixed(4));
  });
}

function deposit(){
  var depositAmount = $("#admin_input").val();
  var config = {
    value: web3.utils.toWei(depositAmount, "ether")
  }
  contractInstance.methods.deposit().send(config)
  .on("transactionHash", function(hash){
    console.log(hash);
  })
  .on("confirmation", function(confirmationNr){
    //console.log("deposit confirmationNr: " + confirmationNr);
  })
  .on("receipt", function(receipt){
    console.log(receipt);
    getBalances();
  })
}

function withdrawAll(){
  contractInstance.methods.withdrawAll().send({from:address}).then(function(res){
    console.log(res);
    getBalances();
  });
}

function cashOutPlayer(){
  contractInstance.methods.cashoutPlayer().send({from:address})
  .on("transactionHash", function(hash){
    console.log("cashOutPlayer transactionHash: " + hash);
    $("#place_bet_button").attr('disabled',true);
    $("#cash_out_button").attr('disabled',true);
    $("#bet_result").text("Cashing out, please wait...");
  })
  .on("confirmation", function(confirmationNr){
    //console.log("deposit confirmationNr: " + confirmationNr);
  })
  .on("receipt", function(receipt){
    console.log("cashOutPlayer receipt: " + receipt);
  })
  .then(function(res){
    console.log(res);
    getBalances();
    $("#place_bet_button").attr('disabled',false);
    $("#cash_out_button").attr('disabled',false);
    $("#bet_result").text("You have cashed out!");
  });
}
