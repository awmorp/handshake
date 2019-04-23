/* The Handshake Game simulation */
/* Anthony Morphett, awmorp@gmail.com */

/* TODO:
  - rewrite to handle undefined array entries.
        option 1: keep using Arrays but use _.filter or similar rather than array lookup to find person references.
        option 2: use Object instead of Array; need to avoid use of .length
  

*/

/** UI State:
 * 0: start state, no data loaded or generated yet
 * 1: data loaded or generated, outbreak not yet run
 * 2: outbreak run, model not yet fitted
 * 3: model fitted
 */
var gUIState = 0;

// Global variables
var gPopData;
var gInfectiousPeriod;
var gPatient0;
var gOutbreakResult;


/* Person object, including their id, name, handshakes */
function Person(id, name, handshakes)
{
  this.id = id;  // A unique identifier number
  this.name = name;  // Display name
  this.handshakes = handshakes ? handshakes : [];  // List of id's of people with whom this person shook hands
  this.compartment = "S";  // Person's current compartment - S, I or R
  this.infectedTime = 0;  // How many timesteps they've been in I for
}

function getPerson( array, id )
{
  if( array[id] ) {
    return( array[id] );
  } else {
    console.log( "getPerson: No entry for id " + id );
    return( null );
  }
}


/* Generates a random set of numshakes handshakes between popsize people, optionally with data entry errors at given error rate (between 0 and 1) */
function makeShakes(popsize, numshakes, names, errorrate)
{
  /* This algorithm yields a complete set of handshakes about r% of the time (with error rate 0), where r is given in the following table:
   *    # people  # handshakes  r
   *    50        2             75%
   *    50        3             58%
   *    50        4             44%
   *    50        5             35%
   *    50        6             28%
   *    50        7             22%
   *    100       2             77%
   *    100       3             61%
   *    100       4             50%
   *    100       5             39%
   *    200       2             78%
   *    200       3             64%
   *    200       4             53%
   *    200       5             44%
   *  (Generated by simulating 10,000 times)
   */
  var fails = [];
  var shakes = [];
  
  /* Initialise the shakes object */
  for( var i = 0; i < popsize; i++ ) {
    shakes[i] = new Person(i, names[i % names.length] + (Math.floor(i / names.length) > 0 ? "_"+Math.floor(i / names.length):""));
  }
//  shakes = _.times( popsize, x=>new Person(x,"#" + x) );
  
  /* Perform handshakes */
  for( var i = 0; i < popsize; i++ )
  {
    var didFail = false;
    for( var j = 0; j < numshakes; j++ ) {
      if( shakes[i].handshakes[j] == undefined )   // Need to do another shake
      {
        var possibilities = _
          .chain(_.range(0,popsize,1))     // Start with everyone
          .difference(shakes[i].handshakes,[i])       // Can't shake hands with anyone you've already shaken hands with, or yourself
          .reject( k => (shakes[k].handshakes.length >= numshakes) )  // Can't shake hands with anyone who's already done all their handshakes
          .value();
//        console.log("possibilities for " + i + ": ", possibilities );
        if(possibilities.length > 0) {
          var shakePartner = _.sample(possibilities);
//          console.log( i + " shakes with " + shakePartner );
          shakes[i].handshakes.push(shakePartner);
          shakes[shakePartner].handshakes.push(i);
        }
        else
        {
//          console.log( "makeShakes: no possibilities for person " + i );
          didFail = true;
        }
      }
    }
    if( didFail ) fails.push(i);
//    console.log( "After " + i + ": shakes=", shakes );
  }
  /* Add some errors */
  if(!errorrate || errorrate < 0) errorrate = 0;
  if(errorrate > 1) errorrate = 1;
  var numErrors = Math.round(popsize*errorrate);
  var alreadyErrored = [];
  while( numErrors-- > 0 ) {
    var errorTarget;
    do { errorTarget = Math.floor(Math.random()*popsize) } while( _.contains(alreadyErrored, errorTarget) );
    alreadyErrored.push(errorTarget);
    /* Three types of error: record completely missing, one or more handshakes missing, or handshakes incorrect */
    switch( Math.floor(Math.random()*3) ) {
      case 0: // Erase the entire record (student didn't submit their data)
      {
//        console.log("Erasing " + errorTarget );
        delete shakes[errorTarget];
        break;
      }
      case 1: // Erase one or more handshakes (student forgot to enter some numbers)
      {
        var k = Math.min( Math.floor(Math.random()*numshakes), shakes[errorTarget].handshakes.length );
        var dropped = []
        while( k-- > 0 ) {
          dropped.push(shakes[errorTarget].handshakes.pop());
        }
//        console.log("Forgetting that " + errorTarget + " shook " + dropped );
        break;
      }
      case 2: // Replace correct handshakes with random numbers (student made data entry errors)
      {
//        console.log( "Overwriting shakes of " + errorTarget );
        for( var i = 0; i < numshakes; i++ ) {
          shakes[errorTarget].handshakes[i] = Math.floor(Math.random()*popsize);
        }
        break;
      }
    }
  }
  
//  console.log( "Final: ", shakes );
//  console.log( _.uniq(shakes.map(a => a.handshakes.length)).length==1?"Shakes successful!":"Shake fail" );
  return( {"shakes": shakes,"fails":fails} );
}


/* Simulates disease transmission according to handshake game rules for the given set of handshakes, infectious period and initial infective patient0. */
function simulate(popData, infectiousPeriod, patient0)
{
  var t = 0;
  var S = [], I = [], R = [];
  var log = []; // record of # of S, I, R at each step
  
  if( !popData[patient0] ) {
    console.log( "Error: specified patient0 " + patient0 + " does not exist." );
    return( [] );
  }
  /* Infect patient 0 */
  enactEvent( popData, t, "initialinfection", patient0 );
  log[0] = {"S": _.filter( popData, p=>(p && p.compartment == "S") ).length, "I": 1, "R": 0};
  
  /* Simulate successive steps */
  /*
  do until no infectives remain:
    for each infective:
      increment their infectedTime
      if infectedTime > infectiousPeriod then
        move them to R - enactEvent( "recovery" )
      else
        perform the next handshake in their list of shakes - enactEvent( "handshake" )
      end if
  */
  do // until no infectives remain
  {  
    t++;
    I = _.filter( popData, p=>(p.compartment == "I") );  // Get current infectives

    for( j = 0; j < I.length; j++ )
    {
      I[j].infectedTime++;  // TODO: should this occur before or after processing their handshake?
      if( I[j].infectedTime >= infectiousPeriod )
      {
        enactEvent( popData, t, "recovery", I[j].id );
      }
      else
      {
        if( I[j].handshakes.length > 0 )
        {
          enactEvent( popData, t, "handshake", I[j].id, I[j].handshakes[0] );
          I[j].handshakes.shift();  // Remove this handshake now it is enacted
        }
      }
    }
    S = _.filter( popData, p=>(p && p.compartment == "S") );
    I = _.filter( popData, p=>(p && p.compartment == "I") );
    R = _.filter( popData, p=>(p && p.compartment == "R") );
    log[t] = {"S": S.length, "I": I.length, "R": R.length };
  } while( I.length > 0 );
  output( "Epidemic ended at t = " + t );
  // Get final susceptibles, recovereds
  output( S.length + " susceptible: "+ _.map(S, p=>p.id) );
  output( R.length + " recovered: " + _.map(R, p=>p.id) );
  return( log );
}

function enactEvent(popData, t, event, person1id, person2id)
{
  switch( event ) {
    case "initialinfection":
    {
      if( !popData[person1id] ) {
        console.log( "Error: specified initial infective " + person1id + " does not exist" );
        return;
      }
      output( "t=" + t + ": The initial infective is " + popData[person1id].name );
      enactEvent( popData, t, "infection", person1id ); // Infect the patient
      break;
    }
    case "infection":
    {
      if( !popData[person1id] ) {
        console.log( "Error: tried to infect non-existent person " + person1id );
        return;
      }
      popData[person1id].compartment = "I";
      popData[person1id].infectedTime = 0;
      output( "t=" + t + ": " + popData[person1id].name + " is now infected!" );
      break;
    }
    case "recovery":
    {
      popData[person1id].compartment = "R";
      output( "t=" + t + ": " + popData[person1id].name + " is now recovered." );
      break;
    }
    case "handshake":
    {
      if( !popData[person1id] || !popData[person2id] ) {
        console.log( "Error: tried to perform handshake between " + person1id + " and " + person2id + " with non-existent person." );
        return;
      }

      output( "t=" + t + ": " + popData[person1id].name + " shakes hands with " + popData[person2id].name );
      /* Decide if person2 becomes infected */
      if( popData[person1id].compartment == "I" )
      {
        if( popData[person2id].compartment == "S" )
        {
          // New infection has occurred!
          enactEvent( popData, t, "infection", person2id );
          
          // Drop any handshakes made by the infectee prior to infection.
          while( popData[person2id].handshakes.length > 0 && popData[person2id].handshakes.shift() != person1id ) {}
        }
        else
        {
          output( "  ... but " + popData[person2id].name + " is already " + (popData[person2id].compartment == "I"?"infected":"recovered")+"." );
        }
      }
      else
      {
        output( "  ... but " + popData[person1id].name + " is not infectious." );
      }
      break;
    }
    default:
    {
      console.log( "ERROR: enactEvent got unknown event '" + event + "'" );
    }
  }
}

//var popsize = 100;
//var numshakes = 5;
//var infectiousperiod = numshakes;
//var errorrate = 0;
//var names = ["Person"]; // List of names for participants. Names are used in the order given, and once exhausted, return to the start but append '_2', etc
//var patient0 = 2;
//
//function doSim()
//{
//  res = makeShakes( popsize, numshakes, names );
//  return( simulate( res.shakes, infectiousperiod, patient0 ) );
//}

function runShakes(n,popsize,numshakes)
{
  var successes = _.chain(_.range(0,n)).map(x=>makeShakes(popsize,numshakes,names)).filter(k=>k.fails.length==0).value().length;
  return( successes )
}

function output( str, replace )
{
  if( replace ) {
    $("#output").text( str + "\n" );
  } else {
    $("#output").text( $("#output").text() + str + "\n" );
  }
}

function updateUIState()
{
  $(".activestate").removeClass("activestate");
  var selector = ".state" + gUIState;
  $(selector).addClass("activestate");
}


function generateButton()
{
  var names = $("#names").val().split("\n");
  var popsize = $("#popsize").val();
  var numshakes = $("#numshakes").val();
  var errorrate = $("#errorrate").val();
  var result = makeShakes( popsize, numshakes, names, errorrate );
  output( JSON.stringify(result, null, '  ' ), true );
  gPopData = result.shakes;
  gUIState = 1;
  updateUIState();
}

function runButton()
{
  var infectiousperiod = $("#infectiousperiod").val();
  var patient0 = $("#patient0").val();
  output( "", true );
  gOutbreakResult = simulate( gPopData, infectiousperiod, patient0 );
  gUIState = 2;
  updateUIState();
}

function exportCSVButton()
{
  output( CSV.serialize( _.map(gOutbreakResult, x=>([x.S, x.I, x.R])) ), true );
}

function fitSIRButton()
{

}