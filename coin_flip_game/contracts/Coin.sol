/* amer_qureshi@yahoo.com */

import "./Ownable.sol";
import "./ProvableAPI.sol";
pragma solidity 0.5.12;

contract Coin is Ownable, usingProvable {

  struct Player {
    address payable playerAddress;
    bytes32 queryId;
    uint256 balance;
    bool isWaiting;
  }

  struct Bet {
    address payable playerAddress;
    uint256 coinFace;
    uint256 betAmount;
  }

  uint256 constant NUM_RANDOM_BYTES_REQUESTED = 1;
  uint256 constant QUERY_EXECUTION_DELAY = 0;
  uint256 constant GAS_FOR_CALLBACK = 200000;
  uint256 public winCount;
  uint256 public lossCount;

  mapping (address => Player) private players;
  mapping (bytes32 => Bet) public bets;

  event LogNewProvableQuery(string description, bytes32 queryId);
  event generatedRandomNumber(bytes32 queryId, uint256 randomNumber, address playerAddress);
  event betPlaced(address playerAddress, uint256 betAmount, string coinFace, bool winner, uint256 payout);

  constructor() public {
  }

  // returns true only if player wins
  function placeBet(uint _coinFace) public payable {
    require(msg.value >= 0.1 ether, "Bet needs to be 0.1 ETH or greater");
    require(_coinFace == 1 || _coinFace == 0, "Must specify Heads or Tails");
    require(msg.value <= address(this).balance - GAS_FOR_CALLBACK,"not enough money in contract to handle the bet");
    require(players[msg.sender].isWaiting == false,"player already has a pending bet");
    // check to ensure that contract balance can cover the bet
    assert(address(this).balance*2 - GAS_FOR_CALLBACK >= msg.value);
    // call the oracle to get the random number
    bytes32 queryId = provable_newRandomDSQuery(
      QUERY_EXECUTION_DELAY,
      NUM_RANDOM_BYTES_REQUESTED,
      GAS_FOR_CALLBACK
    );
    // use the queryId to track the players bet
    players[msg.sender].queryId = queryId;
    players[msg.sender].isWaiting = true;
    bets[queryId].playerAddress = msg.sender;
    bets[queryId].coinFace = _coinFace;
    bets[queryId].betAmount = msg.value;

    emit LogNewProvableQuery("Provable query was sent, standing by for the answer... ", queryId);
  }

  // called from the oracle when it sends back the random
  function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public {
    require(msg.sender == provable_cbAddress());

    uint256 randomNumber = uint256(keccak256(abi.encodePacked(_result))) % 2;
    string memory coinFaceStr = randomNumber == 0 ? "Heads" : "Tails";
    uint256 betAmount = bets[_queryId].betAmount;
    address playerAddress = bets[_queryId].playerAddress;
    emit generatedRandomNumber(_queryId, randomNumber, playerAddress);
    // set waiting false, so player can bet again
    players[playerAddress].isWaiting = false;
    // check to see if we have a winner or looser
    if (players[playerAddress].queryId == _queryId && bets[_queryId].coinFace  == randomNumber) {
      // we have a winner
      winCount++;
      players[playerAddress].balance += betAmount*2;
      emit betPlaced(playerAddress, betAmount, coinFaceStr, true, betAmount*2);
    } else if (players[playerAddress].queryId == _queryId){
      // we have a looser
      lossCount++;
      if (players[playerAddress].balance <= betAmount){
        players[playerAddress].balance = 0;
      } else {
        players[playerAddress].balance -= betAmount;
      }
      emit betPlaced(playerAddress, betAmount, coinFaceStr, false, 0);
    }
  }

  // used to deposit funds to the contract. is public so players can also donate to the contract
  function deposit() payable public {
    // nothing to do. contract balance is automatically updated
  }

  // returns the contracts true balance
  function getContractBalance() public view returns (uint256) {
    return address(this).balance;
  }

  // returns the players balance
  function getPlayerBalance() public view returns (uint256) {
    return players[msg.sender].balance;
  }

  // returns the players waiting status. Can be used for troubleshooting and UX updates
  function getPlayerStatus(address _playerAddress) public view returns (bool) {
    return players[_playerAddress].isWaiting;
  }

  // allow the player to cash out when they have winnings
  function cashoutPlayer() public returns(uint256){
    require(players[msg.sender].balance > 0, "player has 0 balance");
    require(players[msg.sender].balance <= address(this).balance, "contract does not have enough funds");
    require(players[msg.sender].isWaiting == false, "player already has a pending bet");
    uint256 cashoutBalance = players[msg.sender].balance;
    players[msg.sender].balance = 0;
    msg.sender.transfer(cashoutBalance);
    return cashoutBalance;
  }

  // admin function to widthdraw all funds from contract
  function withdrawAll() public onlyOwner returns(uint256) {
       uint256 toTransfer = address(this).balance;
       msg.sender.transfer(toTransfer);
       return toTransfer;
   }

   // admin function to reset player address incase we have a problem with the oracle
   // callback failing and leaving the player account locked out
   function resetPlayerAddress(address _playerAddress) public onlyOwner {
     players[_playerAddress].isWaiting = false;
   }

}
