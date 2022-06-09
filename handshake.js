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
var gPopulationData;
var gOutbreakResult;
var gEventLog;

var gAnimate = true; // whether to show the animation. If false, just do the outbreak calculation, don't animate it.
var gAnimationSpeed = 50;
var gAnimationNumSteps;
var gLastT = 0;

var gAvatarsToLoad = 0;
var gAvatarsLoaded = 0;
var gAvatarsFailed = 0;
var gAvatarsRendered = false;

var gLoadAvatars = false;  // Set this to false to just use default avatars rather than loading randomised avatars from dicebear

var gDebugLevel = 0; // Set this higher to print more debug messages to console

var gAnimStartTime, gAnimEndTime;

/* Person object, including their id, name, handshakes */
function Person(id, name, handshakes, avatarSeed )
{
  this.id = id;  // A unique identifier number
  this.name = name;  // Display name
  this.handshakes = handshakes ? handshakes : [];  // List of id's of people with whom this person shook hands
  this.compartment = "S";  // Person's current compartment - S, I or R
  this.infectedTime = 0;  // How many timesteps they've been in I for
  this.initialInfectionTime = null;  // Time at which this person became infected
  this.avatarSeed = avatarSeed;
  generateAvatar( this );  // Display avatar
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

function generateAvatar( person )
{
  var baseUrl = "https://avatars.dicebear.com/api/human/" + person.avatarSeed + ".svg"
  if( gDebugLevel > 2 ) { console.log( "Requesting " + baseUrl ); }
  var sUrl = baseUrl + "?mood=happy";
  var iUrl = baseUrl + "?mood=sad";
  var mUrl = baseUrl + "?mood=surprised";
  person.avatars = new Object();
  
  var failCallback = function( data ) {
    // HTTP request to dicebear failed. Load default avatars instead.
    if( gLoadAvatars ) console.log( "Dicebear request failed", data );
    gAvatarsFailed++;
    person.avatars.susceptible = $("<div class='avatar avatar_susceptible'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(defaultAvatarHappySVG).addClass("avatar_svg") );
    person.avatars.removed = $("<div class='avatar avatar_removed'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(defaultAvatarHappySVG).addClass("avatar_svg") );
    person.avatars.infectious = $("<div class='avatar avatar_infectious'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(defaultAvatarSadSVG).addClass("avatar_svg") );
    person.avatars.moving = $("<div class='avatar avatar_moving'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(defaultAvatarSurprisedSVG).addClass("avatar_svg") );
    updateAvatarNote();
  };

  if( !gLoadAvatars ) {
    // Don't load remote avatars, just use the default
    failCallback( null );
    return;
  }
  
  // Get susceptible (happy) avatar
  gAvatarsToLoad++;
  $.get( sUrl, null, function( data ) {
  if( gDebugLevel > 2 ) { console.log( "Successfully received " + sUrl, data ); }
    person.avatars.susceptible = $("<div class='avatar avatar_susceptible'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(data.firstChild).clone().addClass("avatar_svg") );
    person.avatars.removed = $("<div class='avatar avatar_removed'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(data.firstChild).addClass("avatar_svg") );
    gAvatarsLoaded++;
    updateAvatarNote();
  } ).fail( failCallback );
  // Get infectious (sad) avatar
  gAvatarsToLoad++;
  $.get( iUrl, null, function( data ) {
    if( gDebugLevel > 2 ) { console.log( "Successfully received " + iUrl, data ); }
    person.avatars.infectious = $("<div class='avatar avatar_infectious'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(data.firstChild).addClass("avatar_svg") );
    gAvatarsLoaded++;
    updateAvatarNote();
  } ).fail( failCallback );
  // Get moving (surprised) avatar
  gAvatarsToLoad++;
  $.get( mUrl, null, function( data ) {
    if( gDebugLevel > 2 ) { console.log( "Successfully received " + rUrl, data ); }
    person.avatars.moving = $("<div class='avatar avatar_moving'><div class='avatar_name'>"+person.name+"</div></div>").prepend( $(data.firstChild).addClass("avatar_svg") );
    gAvatarsLoaded++;
    updateAvatarNote();
  } ).fail( failCallback );
  updateAvatarNote();
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
    shakes[i] = new Person(i, names[i % names.length] + (Math.floor(i / names.length) > 0 ? "_"+Math.floor(i / names.length):""), null, random());
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
        if( gDebugLevel > 1 ) { console.log("Erasing " + errorTarget ); }
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
        if( gDebugLevel > 1 ) { console.log("Forgetting that " + errorTarget + " shook " + dropped ); }
        break;
      }
      case 2: // Replace correct handshakes with random numbers (student made data entry errors)
      {
        if( gDebugLevel > 1 ) { console.log( "Overwriting shakes of " + errorTarget ); }
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
  
  // remove any invalid IDs
  console.log( popData );
  initialvaccinated = initialvaccinated.filter( x => popData[x] );
  initialinfectives = initialinfectives.filter( x => (popData[x] && initialvaccinated.indexOf(x) < 0) );// set difference
  console.log("after cleanup: ", initialvaccinated, initialinfectives );
  
  // Vaccinate
  if( initialvaccinated.length ) {
    enactEvent( popData, eventLog, 0, "initialvaccinate", initialvaccinated );
  }
  
  // Infect initial infectives
  if( initialinfectives.length ) {
    enactEvent( popData, eventLog, 0, "initialinfection", initialinfectives );
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
  if( gDebugLevel > 0 ) { console.log( "eventLog is:", eventLog ); }
  gEventLog = eventLog;
  return( log );
}

function enactEvent(popData, eventLog, t, event, person1id, person2id, fast=false)
{
  var msg, msg2;
  var func, func2;
  const person1 = ($.isArray(person1id) ? person1id.map(x => popData[x]) : popData[person1id] );
  const person2 = ($.isArray(person2id) ? person2id.map(x => popData[x]) : popData[person2id] );
  switch( event ) {
    case "initialinfection":
    {
      if( !$.isArray(person1id) || person1id.length == 0 ) {
        console.log( "Error: invalid person1id for initialinfection" );
        return;
      }
      msg = person1.map(x => x.name).join(", ") + (person1.length > 1 ? " are": " is") + " initially infective!";
      msg = replaceLast( msg, ", ", " and " );

      func = function() {
        person1.forEach( p => animateAvatar(p.avatars.moving, p.avatars.susceptible, p.avatars.infectious) );
        showMessage(msg,"yellow");
      }
      person1.forEach( p => {
        p.compartment = "I";
        p.infectedTime = 0;
        p.initialInfectionTime = t;
      });
      eventLog.push([t,"initialinfection",msg,func,person1id, null, true]);
      output( "t=" + t + ": " + msg );
      break;
    }

    case "initialinfection":
    {
      if( !person1 ) {
        console.log( "Error: specified initial infective " + person1id + " does not exist" );
        return;
      }
      msg = person1.name + " is initially infective!";
      func = function() {
        showMessage(msg,"yellow");
      }
      eventLog.push([t,"initialinfection",msg,func,person1id, null, true]);
      output( "t=" + t + ": " + msg );
      enactEvent( popData, eventLog, t, "infection", person1id ); // Infect the patient
      break;
    }
    case "infection":
    {
      if( !person1 ) {
        console.log( "Error: tried to infect non-existent person " + person1id );
        return;
      }
      person1.compartment = "I";
      person1.infectedTime = 0;
      person1.initialInfectionTime = t;
      msg = person1.name + " is now infected!";
      func = function() {
        showMessage( msg, "red" );
        animateAvatar(person1.avatars.moving, person1.avatars.susceptible, person1.avatars.infectious);
      };
      eventLog.push([t,"infection",msg, func, person1id, null, fast]);
      output( "t=" + t + ": " + msg );
      break;
    }
    case "initialvaccinate":
    {
      if( !$.isArray(person1id) || person1id.length == 0 ) {
        console.log( "Error: invalid person1id for initialvaccinate" );
        return;
      }
      msg = person1.map(x => x.name).join(", ") + (person1.length > 1 ? " are": " is") + " initially vaccinated.";
      msg = replaceLast( msg, ", ", " and " );

      func = function() {
        person1.forEach( p => animateAvatar(p.avatars.moving, p.avatars.susceptible, p.avatars.removed) );
        showMessage(msg,"green");
      }
      person1.forEach( p => (p.compartment = "R") );
      eventLog.push([t,"initialvaccinate",msg,func,person1id, null, true]);
      output( "t=" + t + ": " + msg );
      break;
    }
    case "recovery":
    {
      msg = person1.name + " is now removed.";
      if( person1.compartment == "S" ) {
        func = function() {
          animateAvatar(person1.avatars.moving, person1.avatars.susceptible, person1.avatars.removed);
          showMessage( msg, "green" );
        }
      } else {
        func = function() {
          animateAvatar(person1.avatars.moving, person1.avatars.infectious, person1.avatars.removed);
          showMessage( msg, "yellow" );
        }
      }
      person1.compartment = "R";
      eventLog.push([t,"recovery",msg,func,person1id, null, fast]);
      output( "t=" + t + ": " + msg );
      break;
    }
    case "handshake":
    {
      if( !person1 || !person2 ) {
        console.log( "Error: tried to perform handshake between " + person1id + " and " + person2id + " with non-existent person." );
        return;
      }

      msg = person1.name + " shakes hands with " + person2.name;
      func = function() {
        showMessage( msg, "yellow" );
      }
      eventLog.push([t,"handshake",msg,func,person1id, person2id, fast]);
      output( "t=" + t + ": " + msg );
      /* Decide if person2 becomes infected */
      if( person1.compartment == "I" )
      {
        if( person2.compartment == "S" )
        {
          // New infection has occurred!
          enactEvent( popData, eventLog, t, "infection", person2id );
          
          // Drop any handshakes made by the infectee prior to infection.
          while( person2.handshakes.length > 0 && person2.handshakes.shift() != person1id ) {}
        }
        else
        {
          msg2 = "  ... but " + person2.name + " is already " + (person2.compartment == "I"?"infected":"removed")+".";
          func2 = function() {
            showMessage( msg2, "yellow" );
          }
          eventLog.push([t,"noinfection",msg,func2,person1id, person2id, fast]);
          output( "t=" + t + ": " + msg );
        }
      }
      else
      {
        msg2 = "  ... but " + person1.name + " is not infectious.";
        func2 = function() {
            showMessage( msg2, "yellow" );
          }
        eventLog.push([t,"noinfection",msg,func2,person1id, person2id, fast]);
        output( "t=" + t + ": " + msg );
      }
      break;
    }
    default:
    {
      console.log( "ERROR: enactEvent got unknown event '" + event + "'" );
    }
  }
  popData[person1id] = person1;
  popData[person2id] = person2;
}

function showMessage( msg, colour )
{
  if( gDebugLevel > 0 ) { console.log( "showMessage ("+colour+"): " + msg ); }
}

function animateEvents( eventLog )
{
  if( eventLog.length > 0 ) {
    var e = eventLog.shift();
    if( gDebugLevel > 2 ) { console.log( "animateEvent event is: ", e ); }
    if( e[3] ) {
      e[3]();
    }
    if( e[0] != gLastT ) {
      // Finished a timestep. Update the graph.
      updateGraph();
    }
    gLastT = e[0];
    if( e[6] ) {
      setTimeout( function() {animateEvents( eventLog )}, speedToDelay(gAnimationSpeed) );
    } else {
      animateEvents( eventLog );
    }
  } else {
    updateGraph();
    showMessage( "Finished.", "yellow" );
    gAnimEndTime = Date.now();
    console.log( "Finished at: ", gAnimEndTime, " duration (seconds): ", (gAnimEndTime - gAnimStartTime)/1000 );
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
  updateAnimationCheckbox();
  updateSpeedSlider();
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
  
  const tmp = makeShakes( popsize, numshakes, names, errorrate, seed );
  gPopulationData = tmp.shakes;
  var jsonOut = JSON.stringify(tmp, null, '  ' );
  output( jsonOut, true );
  gUIState = 1;
  updateUIState();
}

function runButton()
{
  gUIState = 1;
  var infectiousperiod = $("#infectiousperiod").val();
  var initialinfectives = parseNatList( $("#initialinfectives").val() );
  var initialvaccinated = parseNatList( $("#vaccinated").val() );
  output( "", true );
  gOutbreakResult = simulate( gPopulationData, infectiousperiod, initialinfectives, initialvaccinated );
  gAnimationNumSteps = gEventLog.length;
  if( gAnimate ) {
    doAnimate();
  }
  updateGraph();
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
  output( CSV.serialize( _.map(gPopulationData, x=>([ x.id, x.infectedTime, x.initialInfectionTime ])) ), true );
}

// Convert an 'animation speed' value (between 0 and 100) to a delay speed in milliseconds
// speed of 0 means 5 seconds total duration.
// speed of 100 means 2 minutes total duration.
// linear interpolation in between.
function speedToDelay( speed )
{
  var numSteps = gAnimationNumSteps ? gAnimationNumSteps : 1;
  if( numSteps > 20 ) numSteps += 10; // in this case, the first and last 10 steps are half as fast
  
  var totalDuration = (5 + (speed/100)*(2*60-5))*1000;
  return( totalDuration/numSteps );
}

function updateSpeedSlider()
{
  gAnimationSpeed = document.getElementById("animationspeed").value;
  var totalDuration = 5 + (gAnimationSpeed/100)*(2*60-5);
  var secs = totalDuration % 60;
  var secsRounded = Math.floor(totalDuration % 60);
  var mins = (totalDuration - secs)/60;
  $('#animspeedcaption').text( (mins > 0 ? mins + " minute": "" ) +(mins > 1 ? "s ":" ") + (secsRounded > 0 ? secsRounded + " second" : "") + (secsRounded > 1 ? "s":"") );
  console.log("Animation delay is " + speedToDelay( gAnimationSpeed ) + " ms" );
  
}

function updateAnimationCheckbox()
{
  gAnimate = $('#animatecheckbox').prop("checked");
  if( gAnimate ) $('#animspeedbox').show();
  else $('#animspeedbox').hide();
}

function renderAvatars()
{
  if( gDebugLevel > 2 ) { console.log( "renderAvatars", gPopulationData ); }
  // Cache some key DOM elements
  const sCircle = $("#circle_s");
  const iCircle = $("#circle_i");
  const rCircle = $("#circle_r");
  const circleDiameter = sCircle.width();

  $(".circle").empty();  // Empty all circles
  _.each( gPopulationData, function(p) {
    p.pos_theta = Math.random()*2*Math.PI;
    p.pos_r = Math.random()*0.8;
    
    /* We have to add them to the DOM here so that we can use their width and height in the position calculations. Elements don't have a width or height until added. */
    sCircle.append(p.avatars.susceptible);
    iCircle.append(p.avatars.infectious);
    rCircle.append(p.avatars.removed);
    
    var awidth = p.avatars.susceptible.width();
    var aheight = p.avatars.susceptible.height();
    var leftp = ((Math.cos(p.pos_theta)*p.pos_r) + 1)/2*circleDiameter - awidth/2;
    var topp = ((Math.sin(p.pos_theta)*p.pos_r) + 1)/2*circleDiameter - aheight/2;
//    console.log( "render "+ p.name + " at "+  leftp +"%, " + topp + "%" );
    $(p.avatars.susceptible).css({left: leftp + "px", top: topp + "px"});
    $(p.avatars.infectious).css({left: leftp + "px", top: topp + "px", visibility: "hidden"});
    $(p.avatars.removed).css({left: leftp + "px", top: topp + "px", visibility: "hidden"});
  } );
  gRenderAvatars = true;
}

function animateAvatar( avatar, start, end )
{
  if( gDebugLevel > 0 ) { console.log( "animateAvatar ", avatar, start, end ); }
  // Move avatar element from location of start element to location of end element.
  const stage = $("#stage");
  start = $(start);
  end = $(end);
  avatar = $(avatar);
  // calculate location of start and end points relative to the stage
  const startx = start.offset().left - stage.offset().left;
  const starty = start.offset().top - stage.offset().top;
  const endx = end.offset().left - stage.offset().left;
  const endy = end.offset().top - stage.offset().top;
  
//  console.log( "Animating from " + startx + ", " + starty + "  to  " + endx + ", " + endy );
  
  start.remove();
  avatar.css({left: startx + "px", top: starty + "px", visibility: "visible"});
  stage.append(avatar);
//  avatar.animate( { left: endx + "px", top: endy + "px"}, 1000, "linear", function() { avatar.detach(); end.css({visibility: "visible"}); } );
  var bezier_params = {
    start: { 
      x: startx, 
      y: starty, 
      angle: -45
    },	
    end: { 
      x:endx,
      y:endy, 
      angle: 45
    }
  }
  avatar.animate( {path : new $.path.bezier(bezier_params)}, 1000, function() { avatar.detach(); end.css({visibility: "visible"}); } );
}

function updateAvatarNote()
{
  const note = $("#avatar_load_notification");
  if( gAvatarsToLoad == 0 ) {
    note.hide();
    return;
  }
  note.text( "Loading avatars... (loaded " + gAvatarsLoaded +"/"+gAvatarsToLoad+(gAvatarsFailed ? ", " + gAvatarsFailed + " failed":"") + ")" );
  if( gAvatarsFailed ) {
    note.removeClass("avatar_load_notification_good").addClass("avatar_load_notification_bad");
  } else if( gAvatarsLoaded ) {
    note.addClass("avatar_load_notification_good").removeClass("avatar_load_notification_bad");
  }
  note.show();
  if( gAvatarsLoaded + gAvatarsFailed == gAvatarsToLoad ) { note.delay(gAvatarsFailed?5000:1000).fadeOut(1000); }
}

function randomiseNames()
{
  // shuffle names
  shuffle(gNameList);
  // load names into the Names textarea
  $("#names").val(gNameList.join("\n"));
}

// Shuffle function from https://javascript.info/task/shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    // swap elements array[i] and array[j]
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function doAnimate()
{
  if( !gAvatarsRendered ) renderAvatars();
  gAnimStartTime = Date.now();
  console.log( "Animation started at: ", gAnimStartTime );
  animateEvents( gEventLog );
}

function updateGraph()
{
  // Set up Chartist.js graph
  var data = {
    labels: gOutbreakResult.map((e,index)=>index), // [0,1,2...N]
    series: [
      {
        name: "S",
        data: gOutbreakResult.map(a=>a.S).slice(0,gLastT+1)
      },
      {
        name: "I",
        data: gOutbreakResult.map(a=>a.I).slice(0,gLastT+1)
      },
      {
        name: "R",
        data: gOutbreakResult.map(a=>a.R).slice(0,gLastT+1)
      }
    ]
  };
  var options = {
    lineSmooth: Chartist.Interpolation.none(),
    axisY: {
      onlyInteger: true,
      low: 0,
      high: (gOutbreakResult[0].S + gOutbreakResult[0].I + gOutbreakResult[0].R)
    },
    axisX: {
      low: 0,
      high: gOutbreakResult.length + 1,
      onlyInteger: true,
    },
    plugins: [
      Chartist.plugins.ctHandshakeAxes()
    ]
  };
  // TODO: add proper axes with arrows and axis labels.
  // Reference code here: https://github.com/alexstanbury/chartist-plugin-axistitle/blob/master/src/scripts/chartist-plugin-axistitle.js
//  console.log( data );
  new Chartist.Line('#graph', data, options);
}

function replaceLast(str, what, replacement) {
        var pcs = str.split(what);
        if( pcs.length <= 1 ) return( str );
        var lastPc = pcs.pop();
        return pcs.join(what) + replacement + lastPc;
};