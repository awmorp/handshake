/* The Handshake Game simulation */
/* Anthony Morphett, awmorp@gmail.com */

/** UI State:
 * 0: start state, no data loaded or generated yet
 * 1: data loaded or generated, outbreak not yet run
 * 2: outbreak run, model not yet fitted
 * 3: model fitted
 */
var gUIState = 0;

// Global variables
var gSimResult;
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
  this.initialInfectionTime = null;  // Time at which this person became infected
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
function makeShakes(popsize, numshakes, names, errorrate, seed)
{
  var fails = [];
  var shakes = [];
//  debugger;

  /* Use a seeded pseudo-random number generator, as the builtin Javascript PRNG can't be seeded */
  var random = aleaFromSeed(seed);
  // convenient function to sample a random element from a list
  var sample = function(list) {return list[random.nextInt(list.length)];}
  
  /* Initialise the shakes object */
  for( var i = 0; i < popsize; i++ ) {
    shakes[i] = new Person(i, names[i % names.length] + (Math.floor(i / names.length) > 0 ? "_"+Math.floor(i / names.length):""));
  }
  if( numshakes == 0 || popsize == 0 ) return( {"shakes": shakes,"fails":fails} ); // Trivial cases, nothing to do
  
  var remaining = _.range(0,popsize,1);  // People who still need to do more handshakes
  
  /* Perform handshakes */
  do {
    // Choose first handshake partner
    var firstShaker = sample(remaining);
    var potentialPartners = _
      .chain(remaining)  // Start with everyone who still needs to do more handshakes
      .difference(shakes[firstShaker].handshakes,[firstShaker]) // Can't shake hands with anyone you've already shaken hands with, or yourself
      .value();
    if( potentialPartners.length > 0 ) {
      // Found some potential shake partners. Select one at random and record the shake.
      var secondShaker = sample(potentialPartners);
//      console.log( firstShaker + " shakes with " + secondShaker );
      shakes[firstShaker].handshakes.push(secondShaker);
      shakes[secondShaker].handshakes.push(firstShaker);

      remaining = _.reject(remaining, k => (shakes[k].handshakes.length >= numshakes) ); // Remove anyone who has finished all their shakes
//      console.log( "remaining: " + remaining );
    } else {
      // Couldn't find anyone for this person to shake with
//      console.log( "No shake partners for " + firstShaker );
      fails.push(firstShaker);
      remaining = _.without(remaining, firstShaker);
    }
  } while( remaining.length > 0 );
  
  addErrors( shakes, popsize, numshakes, errorrate, random);
  //  console.log( "Final: ", shakes );
  //  console.log( _.uniq(shakes.map(a => a.handshakes.length)).length==1?"Shakes successful!":"Shake fail" );
  return( {"shakes": shakes,"fails":fails, "seed": seed} );

}

function makeShakes_old(popsize, numshakes, names, errorrate)
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
  addErrors( shakes, popsize, numshakes, errorrate);
  //  console.log( "Final: ", shakes );
  //  console.log( _.uniq(shakes.map(a => a.handshakes.length)).length==1?"Shakes successful!":"Shake fail" );
  return( {"shakes": shakes,"fails":fails} );
}

function addErrors( shakes, popsize, numshakes, errorrate, random)
{
  /* Add some errors */
  if(!errorrate || errorrate < 0) errorrate = 0;
  if(errorrate > 1) errorrate = 1;
  var numErrors = Math.round(popsize*errorrate);
  var alreadyErrored = [];
  while( numErrors-- > 0 ) {
    var errorTarget;
    do { errorTarget = Math.floor(random()*popsize) } while( _.contains(alreadyErrored, errorTarget) );
    alreadyErrored.push(errorTarget);
    /* Three types of error: record completely missing, one or more handshakes missing, or handshakes incorrect */
    switch( Math.floor(random()*3) ) {
      case 0: // Erase the entire record (student didn't submit their data)
      {
        console.log("Erasing " + errorTarget );
        delete shakes[errorTarget];
        break;
      }
      case 1: // Erase one or more handshakes (student forgot to enter some numbers)
      {
        var k = Math.min( Math.floor(random()*numshakes), shakes[errorTarget].handshakes.length );
        var dropped = []
        while( k-- > 0 ) {
          dropped.push(shakes[errorTarget].handshakes.pop());
        }
        console.log("Forgetting that " + errorTarget + " shook " + dropped );
        break;
      }
      case 2: // Replace correct handshakes with random numbers (student made data entry errors)
      {
        console.log( "Overwriting shakes of " + errorTarget );
        for( var i = 0; i < numshakes; i++ ) {
          shakes[errorTarget].handshakes[i] = Math.floor(random()*popsize);
        }
        break;
      }
    }
  }
}


/* Simulates disease transmission according to handshake game rules for the given set of handshakes, infectious period, initial infectives and initially vaccinated individuals. */
function simulate(popData, infectiousPeriod, initialinfectives, initialvaccinated)
{
  var t = 0;
  var S = [], I = [], R = [];
  var log = []; // record of # of S, I, R at each step
  var eventLog = new Array; //
  eventLog[0] = new Array;
  
  // Vaccinate
  for( var i = 0; i < initialvaccinated.length; i++ ) {
    if( !popData[initialvaccinated[i]] ) {
      console.log( "Error: specified vaccinatee " + initialvaccinated[i] + " does not exist." );
    }
    /* Vaccinate the person */
    enactEvent( popData, eventLog, 0, "initialvaccinate", initialvaccinated[i] );
  }

  
  // Infect initial infectives
  for( var i = 0; i < initialinfectives.length; i++ ) {
    if( !popData[initialinfectives[i]] ) {
      console.log( "Error: specified initial infective " + initialinfectives[i] + " does not exist." );
    }
    /* Infect initial infective */
    enactEvent( popData, eventLog, 0, "initialinfection", initialinfectives[i] );
  }
  S = _.filter( popData, p=>(p && p.compartment == "S") );
  I = _.filter( popData, p=>(p && p.compartment == "I") );
  R = _.filter( popData, p=>(p && p.compartment == "R") );
  log[0] = {"S": S.length, "I": I.length, "R": R.length };

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
  while( I.length > 0 ) // until no infectives remain
  {  
    t++;
    eventLog[t] = new Array;
    I = _.filter( popData, p=>(p.compartment == "I") );  // Get current infectives

    for( j = 0; j < I.length; j++ )
    {
      I[j].infectedTime++;
      if( (I[j].infectedTime > infectiousPeriod) || (I[j].handshakes.length == 0) )
      {
        enactEvent( popData, eventLog, t, "recovery", I[j].id );
      }
      else
      {
        enactEvent( popData, eventLog, t, "handshake", I[j].id, I[j].handshakes[0] );
        I[j].handshakes.shift();  // Remove this handshake now it is enacted
      }
    }
    S = _.filter( popData, p=>(p && p.compartment == "S") );
    I = _.filter( popData, p=>(p && p.compartment == "I") );
    R = _.filter( popData, p=>(p && p.compartment == "R") );
    log[t] = {"S": S.length, "I": I.length, "R": R.length };
  }// while( I.length > 0 );
  output( "Epidemic ended at t = " + t );
  // Get final susceptibles, recovereds
  output( S.length + " susceptible: "+ _.map(S, p=>p.id) );
  output( R.length + " removed: " + _.map(R, p=>p.id) );
  console.log( eventLog );
  return( log );
}

function enactEvent(popData, eventLog, t, event, person1id, person2id)
{
  switch( event ) {
    case "initialinfection":
    {
      if( !popData[person1id] ) {
        console.log( "Error: specified initial infective " + person1id + " does not exist" );
        return;
      }
      output( "t=" + t + ": " + popData[person1id].name + " is initially infective!" );
      eventLog[t].push([t,"initialinfection",person1id]);
      enactEvent( popData, eventLog, t, "infection", person1id ); // Infect the patient
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
      popData[person1id].initialInfectionTime = t;
      output( "t=" + t + ": " + popData[person1id].name + " is now infected!" );
      eventLog[t].push([t,"infection",person1id]);
      break;
    }
    case "initialvaccinate":
    {
      if( !popData[person1id] ) {
        console.log( "Error: specified vaccinatee " + person1id + " does not exist" );
        return;
      }
      output( "t=" + t + ": " + popData[person1id].name + " is initially vaccinated." );
      eventLog[t].push([t,"initialvaccinate",person1id]);
      enactEvent( popData, eventLog, t, "recovery", person1id ); // Infect the patient
      break;
    }
    case "recovery":
    {
      popData[person1id].compartment = "R";
      output( "t=" + t + ": " + popData[person1id].name + " is now removed." );
      eventLog[t].push([t,"recovery",person1id]);
      break;
    }
    case "handshake":
    {
      if( !popData[person1id] || !popData[person2id] ) {
        console.log( "Error: tried to perform handshake between " + person1id + " and " + person2id + " with non-existent person." );
        return;
      }

      output( "t=" + t + ": " + popData[person1id].name + " shakes hands with " + popData[person2id].name );
      eventLog[t].push([t,"handshake",person1id, person2id]);
      /* Decide if person2 becomes infected */
      if( popData[person1id].compartment == "I" )
      {
        if( popData[person2id].compartment == "S" )
        {
          // New infection has occurred!
          enactEvent( popData, eventLog, t, "infection", person2id );
          
          // Drop any handshakes made by the infectee prior to infection.
          while( popData[person2id].handshakes.length > 0 && popData[person2id].handshakes.shift() != person1id ) {}
        }
        else
        {
          output( "  ... but " + popData[person2id].name + " is already " + (popData[person2id].compartment == "I"?"infected":"removed")+"." );
          eventLog[t].push([t,"noinfection",person1id, person2id, (popData[person2id].compartment == "I"?"infected":"removed")]);
        }
      }
      else
      {
        output( "  ... but " + popData[person1id].name + " is not infectious." );
        eventLog[t].push([t,"noinfection",person1id, person2id, "notinfectious"]);
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
    $("#output"+gUIState).text( str + "\n" );
  } else {
    $("#output"+gUIState).text( $("#output"+gUIState).text() + str + "\n" );
  }
}

// Parse a list of nonnegative integers, separated by space or comma
function parseNatList( str )
{
  var result = str.split(/[,\s]/);
  result = _.chain(result).map( i => parseInt(i,10) ).filter( i => (i >= 0) ).uniq().value();
  return( result );

}

function updateUIState()
{
  $(".activestate").removeClass("activestate");
  var selector = ".state" + gUIState;
  $(selector).addClass("activestate");
}


function generateButton()
{
  gUIState = 0;
  var names = $("#names").val().split("\n");
  var popsize = $("#popsize").val();
  var numshakes = $("#numshakes").val();
  var errorrate = $("#errorrate").val();
  var seed = $("#seed").val();
  if( seed == "" ) {
    seed = Math.floor(Math.random()*10000000);
  } else {
    seed = parseInt(seed);
  }
  $("#seed").val("");
  $("#lastseed").text("Last seed: " + seed ).show();
  
  gSimResult = makeShakes( popsize, numshakes, names, errorrate, seed );
  var jsonOut = JSON.stringify(gSimResult, null, '  ' );
  output( jsonOut, true );
  gUIState = 1;
  updateUIState();
}

function runButton()
{
  gUIState = 1;
  gPopData = JSON.parse(JSON.stringify(gSimResult.shakes)) // Make a copy of the simulated shakes so we can re-run the simulation if needed (deep copy)
  var infectiousperiod = $("#infectiousperiod").val();
  var initialinfectives = parseNatList( $("#initialinfectives").val() );
  var initialvaccinated = parseNatList( $("#vaccinated").val() );
  output( "", true );
  gOutbreakResult = simulate( gPopData, infectiousperiod, initialinfectives, initialvaccinated );
  gUIState = 2;
  updateUIState();
}

function exportCSVButton()
{
  gUIState = 2;
  output( CSV.serialize( _.map(gOutbreakResult, x=>([x.S, x.I, x.R])) ), true );
}

function exportInfectionTimesButton()
{
  gUIState = 2;
  output( CSV.serialize( _.map(gPopData, x=>([ x.id, x.infectedTime, x.initialInfectionTime ])) ), true );
}

function fitSIRButton()
{
  /* Fit SIR model to outbreak data */
  
  var maxT = gOutbreakData.length - 1;
  
  // Calculate derivatives ds/dt, di/dt, dr/dt
  var derivs = function( x, beta, gamma ) {
    var dsdt = -beta*x[0]*x[1];
    var didt = beta*x[0]*x[1] - gamma*x[1];
    var drdt = gamma*x[1];
    return( [dsdt, didt, drdt] );
  }
  
  var costfunc = function( beta, gamma ) {

  }
  
  // Possible libraries to use:
  // ODE solvers:
  //  * https://github.com/littleredcomputer/odex-js   
  //  * https://llarsen71.github.io/GMA1D/Docs/files/ODE-js.html
  // Optimisers:
  //  * https://github.com/tab58/ndarray-optimization
  //  * https://github.com/benfred/fmin
  // Graphing:
  //  * https://mathjs.org/examples/browser/rocket_trajectory_optimization.html.html
  
  
  
  
}