/* The Handshake Game simulation */
/* Anthony Morphett, awmorp@gmail.com */

/* Person object, including their id, name, handshakes */
function Person(id, name, handshakes)
{
  this.id = id;  // A unique identifier number
  this.name = name;  // Display name
  this.handshakes = handshakes ? handshakes : [];  // List of id's of people with whom this person shook hands
  this.compartment = "S";  // Person's current compartment - S, I or R
  this.infectedTime = 0;  // How many timesteps they've been in I for
}


/* Generates a random set of numshakes handshakes between popsize people. */
function makeShakes(popsize,numshakes)
{
  /* This algorithm yields a complete set of handshakes about r% of the time, where r is given in the following table:
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
  var shakes = new Array(popsize);
  /* Initialise the shakes object */
  shakes = _.times( popsize, x=>new Person(x,"Name_" + x) );
  
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
//  console.log( "Final: ", shakes );
//  console.log( _.uniq(shakes.map(a => a.handshakes.length)).length==1?"Shakes successful!":"Shake fail" );
  return( {"shakes": shakes,"fails":fails} );
}


/* Simulates disease transmission according to handshake game rules for the given set of handshakes, infectious period and initial infective patient0. */
function simulate(shakes, infectiousPeriod, patient0)
{
  var state = shakes;
  var t = 0;
  
  /* Infect patient 0 */
  enactEvent( state, t, "initialinfection", patient0 );
  
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
  var I = [];
  do // until no infectives remain
  {  
    t++;
    I = _.filter( state, p=>(p.compartment == "I") );  // Get current infectives

    for( j = 0; j < I.length; j++ )
    {
      I[j].infectedTime++;  // TODO: should this occur before or after processing their handshake?
      if( I[j].infectedTime >= infectiousPeriod )
      {
        enactEvent( state, t, "recovery", I[j].id );
      }
      else
      {
        if( I[j].handshakes.length > 0 )
        {
          enactEvent( state, t, "handshake", I[j].id, I[j].handshakes[0] );
          I[j].handshakes.shift();  // Remove this handshake now it is enacted
        }
      }
    }
  } while( I.length > 0 );
  console.log( "Epidemic ended at t = " + t );
  // Get final susceptibles, recovereds
  S = _.chain(_.filter( state, p=>(p.compartment == "S") )).map( p=>p.id ).value();
  R = _.chain(_.filter( state, p=>(p.compartment == "R") )).map( p=>p.id ).value();
  console.log( S.length + " susceptible: "+ S );
  console.log( R.length + " recovered: " + R );
}

function enactEvent(state, t, event, person1id, person2id)
{
  switch( event ) {
    case "initialinfection":
    {
      console.log( "t=" + t + ": The initial infective is " + state[person1id].name );
      enactEvent( state, t, "infection", person1id ); // Infect the patient
      break;
    }
    case "infection":
    {
      state[person1id].compartment = "I";
      state[person1id].infectedTime = 0;
      console.log( "t=" + t + ": " + state[person1id].name + " is now infected!" );
      break;
    }
    case "recovery":
    {
      state[person1id].compartment = "R";
      console.log( "t=" + t + ": " + state[person1id].name + " is now recovered." );
      break;
    }
    case "handshake":
    {
      console.log( "t=" + t + ": " + state[person1id].name + " shakes hands with " + state[person2id].name );
      /* Decide if person2 becomes infected */
      if( state[person1id].compartment == "I" )
      {
        if( state[person2id].compartment == "S" )
        {
          // New infection has occurred!
          enactEvent( state, t, "infection", person2id );
          
          // Drop any handshakes made by the infectee prior to infection.
          while( state[person2id].handshakes.shift() != person1id ) { }
        }
        else
        {
          console.log( "  ... but " + state[person2id].name + " is already " + (state[person2id].compartment == "I"?"infected":"recovered")+"." );
        }
      }
      else
      {
        console.log( "  ... but " + state[person1id].name + " is not infectious." );
      }
      break;
    }
    default:
    {
      console.log( "ERROR: enactEvent got unknown event '" + event + "'" );
    }
  }
}

var popsize = 100;
var numshakes = 5;
var infectiousperiod = 4;
var patient0 = 2;

function doSim()
{
  res = makeShakes( popsize, numshakes );
  simulate( res.shakes, infectiousperiod, patient0 );
}

function doShakes(n,popsize,numshakes)
{
  var successes = _.chain(_.range(0,n)).map(x=>makeShakes(popsize,numshakes)).filter(k=>k.fails.length==0).value().length;
  return( successes )
}