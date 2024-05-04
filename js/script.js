let userMarker = null; // no intial marker
const map = L.map('map');

//custom markers
const myIcon = L.icon({
    iconUrl: 'images/usericon.png',
    iconSize: [36, 36],//width, height
    popupAnchor: [0, -25], 
    clickable: true,  // interact with mouse clicks
    title: "My Location",    //tooltip
    zIndexOffset: 1000 // stacking of icon relative to other map overlays
});

const airportIcon = L.icon({
    iconUrl: 'images/floweruser.png',
    iconSize: [40, 40],               
    popupAnchor: [0, -30]          
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

//geolocating user function:
let findUserLocation = () => {
    navigator.geolocation.getCurrentPosition((position) => { //get current position of the device using navigator.geolocation API
        let mylat = position.coords.latitude;
        let mylong = position.coords.longitude;

        // create the marker and set the view the first time geolocation is successful
        if (!userMarker) {
            map.setView([mylat, mylong], 13); // set map view 
            userMarker = L.marker([mylat, mylong], {icon: myIcon}).addTo(map); 
        } else {
            userMarker.setLatLng([mylat, mylong]); // update markers position
            map.setView([mylat, mylong], 13); // update map view to new position
        }

        userMarker.bindPopup(`Coordinates: ${mylat.toFixed(5)}, ${mylong.toFixed(5)}`).openPopup(); //popup that shows coordinates rounded to  5 decimal places

    }, (err) => { //error incase geolocation cant be retrieved
        console.error(err);
        alert('Unable to retrieve your location');
      }, {
        enableHighAccuracy: true,
        timeout: 10000
    });
}

findUserLocation();
  
//creates event listen for locateMe button to show where you are on the map
document.getElementById('locateMe').addEventListener('click', findUserLocation);

const selectedAirports = []; //empty array for airports
let polyline = null; //later will be used to store the distance between 2 airports
let selectedDistance = 0; // ^^


//convert the GPS coordinates to decimals
function convertToDecimal(degrees, minutes, direction) {
    let decimal = degrees + minutes / 60;
    if (direction === 'S' || direction === 'W') { //if direction is south or west, make decimal value negative
        decimal *= -1;
    }
    return decimal;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
        const earthRadiusMeters = 6371000; // earth's radius in meters
        //converting lat & lon from degrees to radians
        const startLat1 = lat1 * Math.PI / 180;
        const endLat2 = lat2 * Math.PI / 180;
        const changeInLat = (lat2 - lat1) * Math.PI / 180;
        const changeInLon = (lon2 - lon1) * Math.PI / 180;
    
        const a = Math.sin(changeInLat / 2) * Math.sin(changeInLat / 2) +
                  Math.cos(startLat1) * Math.cos(endLat2) *
                  Math.sin(changeInLon / 2) * Math.sin(changeInLon / 2);
                  //angular distance
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
        const distanceMeters = earthRadiusMeters * c; //get distance in meters
        return distanceMeters / 1000; // convert to kms
}
    
//fetch weather data
async function fetchWeatherData(lat, lon) {
    const apiKey = '552ede3c087c5810a2bbbf22dfea5b8c';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    try {
        const response = await fetch(url); //fetch api to make a get request to url
        const data = await response.json(); //parse json from response
        const weatherDescription = data.weather[0].description; //get weather description from the data weather array
        const temperature = data.main.temp;
        return { weatherDescription, temperature };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return { weatherDescription: 'N/A', temperature: 'N/A' };
    }
}
//parsing the airport data
fetch('json/mAirports.json')
    .then(response => response.json())
    .then(data => {
        data.forEach(airport => { //iterate over each object
            const location = airport['Geographic Location'].match(/(\d{1,2})(\d{2})([NS])\s(\d{1,3})(\d{2})([EW])/); //parsing coordinates using regex - (\d{1,2}) matches the degress of latitude (must be a one or 2 digit number), (\d{2}) matching the minutes of lat(2 digits), ([NS]): matches either North or South, (\d{1,3}): degrees of long, 1-3 digits.(\d{2}): minutes of long, ([EW]) east or west 
            if (location) {
                const latDeg = parseInt(location[1], 10); //parsing degrees from regex match, ",10" specifies it should be interpreted as base 10
                const latMin = parseInt(location[2], 10); //parsing minutes
                const latDir = location[3]; //n or s
                const lonDeg = parseInt(location[4], 10); //parsing degrees
                const lonMin = parseInt(location[5], 10); //parsing minutes
                const lonDir = location[6]; //east or west
                //convert coordinates to decimal 
                const lat = convertToDecimal(latDeg, latMin, latDir); 
                const lng = convertToDecimal(lonDeg, lonMin, lonDir);

                //create marker for all the airports with the calculated lat long & with my custom icon, and add to map
                const marker = L.marker([lat, lng], {icon: airportIcon}).addTo(map);
                
                //creating event listener for when airport marker is clicked:
                marker.on('touchstart', function () {
                    fetchWeatherData(lat, lng).then(weatherData => { //get weather data and display in a popup
                        const weatherInfo = `Weather: ${weatherData.weatherDescription}, Temp: ${(weatherData.temperature - 273.15).toFixed(2)}°C`;
                        marker.bindPopup(`${airport['Airport Name']}, ${airport['City Name']}, ${airport['Country']}<br>${weatherInfo}`).openPopup();
                    }).catch(error => {
                        console.error('Failed to fetch weather data:', error);
                       
                    });
                    //calculating distance when 2 airports are clicked:
                    if (selectedAirports.length < 2) {
                        selectedAirports.push({ lat, lng, airport }); //if array < 1, push coordinates of selected airport onto the array
                        if (selectedAirports.length === 2) { //if 2 airports are selected:
                            const [airport1, airport2] = selectedAirports; //assign variables in array as airport1, airport2
                            selectedDistance = calculateDistance(airport1.lat, airport1.lng, airport2.lat, airport2.lng);
                            if (polyline) { //remove existing polyline(if there is one) and make a new one between the selected airports
                                map.removeLayer(polyline);
                            }
                            polyline = L.polyline([[airport1.lat, airport1.lng], [airport2.lat, airport2.lng]], { color: 'aqua' }).addTo(map);
                            map.fitBounds(polyline.getBounds()); // map view to include the entire route
                            $('#flights').fadeIn(); //display flight cards w/ fade in
                            displayFlights();
                        }
                    } 
                });

                //creating event listener for when airport marker is clicked:
                marker.on('click', function () {
                    fetchWeatherData(lat, lng).then(weatherData => { //get weather data and display in a popup
                        const weatherInfo = `Weather: ${weatherData.weatherDescription}, Temp: ${(weatherData.temperature - 273.15).toFixed(2)}°C`;
                        marker.bindPopup(`${airport['Airport Name']}, ${airport['City Name']}, ${airport['Country']}<br>${weatherInfo}`).openPopup();
                    }).catch(error => {
                        console.error('Failed to fetch weather data:', error);
                       
                    });
                    //calculating distance when 2 airports are clicked:
                    if (selectedAirports.length < 2) {
                        selectedAirports.push({ lat, lng, airport }); //if array < 1, push coordinates of selected airport onto the array
                        if (selectedAirports.length === 2) { //if 2 airports are selected:
                            const [airport1, airport2] = selectedAirports; //assign variables in array as airport1, airport2
                            selectedDistance = calculateDistance(airport1.lat, airport1.lng, airport2.lat, airport2.lng);
                            if (polyline) { //remove existing polyline(if there is one) and make a new one between the selected airports
                                map.removeLayer(polyline);
                            }
                            polyline = L.polyline([[airport1.lat, airport1.lng], [airport2.lat, airport2.lng]], { color: 'aqua' }).addTo(map);
                            map.fitBounds(polyline.getBounds()); // map view to include the entire route
                            $('#flights').fadeIn(); //display flight cards w/ fade in
                            displayFlights();
                        }
                    } 
                });

            }
        });
    });

    
let flights = []; //store flight data from json file
let cartItems = []; //will store flight items added to shopping cart
let currentCategory = 'all'; //for the filter to display flights

//parsing flights 
fetch('json/fake_flights.json')
    .then(response => response.json()) //parse json response into a js object
    .then(data => {
        flights = data; //put the data in the flights array
        displayFlights(); 
    });

    function displayFlights() { 
        const flightContainer = $('#flights'); //container holding the cards
        flightContainer.empty(); //clear existing content
        let sortedFlights = [...flights]; //creating a copy of the flights array 
        switch (currentCategory) { //sorting the flights based on the categories:
            case 'duration': //sort by asc order
                sortedFlights.sort((a, b) => a.duration - b.duration);
                break;
            case 'cost':
                sortedFlights.sort((a, b) => a.totalCost - b.totalCost);
                break;
            case 'type':
                sortedFlights.sort((a, b) => a.type_of_plane.localeCompare(b.type_of_plane));
                break;
        }
        //recalculating duration based on selected distance and speed
        sortedFlights.forEach(flight => {
            flight.distance = selectedDistance; // set distance for each flight
            flight.duration = flight.distance / flight.speed_kph * 60; // calculate the duration in minutes
        });

        //starting a new row for the flight cards w/ bootstrap (separting the html row weirdly because for some reason the cards will only layout how i want it when i do it this way - adding bootstrap classes etc was not working for me!)
        const rowHtml = `<div class="row g-3">`;
        flightContainer.append(rowHtml); //append to flight container

        //loop for displaying flight info
        sortedFlights.forEach(flight => {
            const duration = typeof flight.duration === 'number' ? `${flight.duration.toFixed(2)} minutes` : 'N/A';  //if duration is of type number, format to 2 decimal places, else N/A
            const distance = typeof flight.distance === 'number' ? `${flight.distance.toFixed(2)} km` : 'N/A';
            const totalCost = calculateTotalCost(flight); //total cost based on the flight
    
            const flightHTML = `
            <div class="col-md-4">
                <div class="card pixel-card">
                    <img src="${flight.image}" class="card-img-top" alt="${flight.type_of_plane}">
                    <div class="card-body">
                        <h3 class="card-title text-center"><span style="color: purple;">${flight.type_of_plane}</span></h3>
                        <p>Speed: <span style="color: purple;">${flight.speed_kph} km/h</span></p>
                        <p>Type: <span style="color: purple;">${flight.type_of_plane}</span></p>
                        <p>Seats Remaining: <span style="color: purple;" class="seats-remaining">${flight.seats_remaining}</span></p>
                        <p>Cost per KM: <span style="color: purple;">${flight.price_per_km}</span></p>
                        <p>Extra Fuel Charge: <span style="color: purple;">${flight.extraFuelCharge}</span></p>
                        <p>Max Takeoff Altitude: <span style="color: purple;">${flight.maxTakeOffAlt} meters</span></p>
                        <p>Duration: <span style="color: purple;">${duration}</span></p>
                        <p>Distance: <span style="color: purple;">${distance}</span></p>
                        <p>Total Cost: <span style="color: purple;">${totalCost}</span></p>
                        <button class="book-flight-btn d-block mx-auto" data-flight-id="${flight.id}">Book</button>
                    </div>
                </div>
            </div>
        `;

        // appending each flight card to the last .row 
        flightContainer.find('.row:last').append(flightHTML);
    });
    // closing the row
    flightContainer.append('</div>');
}
    
//remove existing click event handlers, and then attach a new one (the button wasnt working so removing, then adding seemed to work!)
$(document).off('click', '.book-flight-btn').on('click', '.book-flight-btn', function(event) {
    const flightId = $(this).data('flight-id'); //retrive flight-id to identify what flight was targeted 
    const flight = flights.find(f => f.id === flightId); //finding the flight object in the flights array that matches the id

    if (flight && flight.seats_remaining > 0) {
        flight.seats_remaining--; //decrement number of flights remaining on the card
        
        // add the destination information to the flight object by copying all properties from selected flight.
        const flightWithDestination = { 
            ...flight,
            destination: selectedAirports[1] ? selectedAirports[1].airport['City Name'] : 'Unknown' //updating destination with the city name of the second flight selected/ else unknown
        };
        //add updated flight object to the cartItems array that we'll need in updateCart
        cartItems.push(flightWithDestination);
        updateCart(); //calling to reflect the changes 

        // finding the closest parent element of the button, then find the element w/ class (seats-remaining) and update the text on the card
        $(this).closest('.card-body').find('.seats-remaining').text(flight.seats_remaining);
    } else {
        alert('No more seats available for this flight.');
    }
});
        
function calculateTotalCost(flight) { //calculating cost distance * price per km
    if (!flight.distance || !flight.price_per_km) {
        return 'N/A';
    }
    let cost = flight.distance * flight.price_per_km;
    if (flight.weather === 'rain') {
        cost += flight.extraFuelCharge; //add extra fuel charge if raining
    }
    if (flight.weather === 'snow') {
        cost += flight.extraFuelCharge * 2; //add extra fuel charge if snowing
    }
    return cost.toFixed(2);
}

//for filtering the flight cards
document.getElementById('categoryChooser').addEventListener('change', (event) => {
    currentCategory = event.target.value;
    displayFlights();
});

//stores cart items in local storage so when you refresh the flights are still in the cart
document.addEventListener('DOMContentLoaded', () => {
    const storedCartItems = localStorage.getItem('cartItems'); //retrieve from local storage
    if (storedCartItems) {
        cartItems.push(...JSON.parse(storedCartItems)); //if stored cart items exist, parse from JSON string - and add to cartItems array
        updateCart(); //updates cart
    }
});
//offcanvas cart function
function updateCart() {
    const cartItemsContainer = document.getElementById('cartItems');
    cartItemsContainer.innerHTML = '';
    //initialise counters
    let totalSeatsBooked = 0;
    let totalCost = 0;

    //loops through each flight in cart items array
    cartItems.forEach(flight => {
        totalSeatsBooked += 1;
        totalCost += parseFloat(calculateTotalCost(flight)); //add cost of current flight to the total & converting to a float instead of String
        //creating new div for each cart item
        const item = document.createElement('div');
        item.className = 'cart-item';
        //flight details + remove button
        item.innerHTML = `
            <h5>${flight.type_of_plane}</h5>
            <p>Seats Booked: 1</p>
            <p>Cost: $${calculateTotalCost(flight)}</p>
            <button class="btn btn-danger remove-item-btn" data-flight-id="${flight.id}">Remove</button>
        `;
        cartItemsContainer.appendChild(item); //appending new div to cart items container
    });

    document.getElementById('totalSeatsBooked').textContent = `Total Seats Booked: ${totalSeatsBooked}`;
    document.getElementById('totalCost').innerHTML = `<strong>Total Cost: $${totalCost.toFixed(2)}</strong>`;
    //store cart items in localStorage, make array a JSON string
    localStorage.setItem('cartItems', JSON.stringify(cartItems));

}

// event listener for remove item button:
$(document).on('click', '.remove-item-btn', function() {
    const flightId = Number($(this).data('flight-id')); //converting flight-id data to a number for comparisons
    const index = cartItems.findIndex(flight => flight.id === flightId); //getting index of flight in the cartItems array that matches flightId
    if (index !== -1) {
        cartItems.splice(index, 1); //remove 1 item from array at 'index'
        updateCart(); //update cart to show that item was removed
    }
});

//event listener for book flight button:
document.getElementById('bookFlightsBtn').addEventListener('click', () => {
    if (cartItems.length === 0) {
        alert('No flights selected for booking.');
        return;
    }else {
    $('#bookingModal').modal('show'); //if items are in the cart show the modal w/ form details to fill out
    }    
});

document.getElementById('clearCartBtn').addEventListener('click', () => {
    if (cartItems.length === 0) {
        alert('The cart is already empty.');
        return;
    }
    const confirmClear = confirm('Are you sure you want to clear the cart?');
    if (confirmClear) {
        cartItems.length = 0;
        updateCart();
        alert('Cart cleared successfully.');
    }
    displayFlights();
});

//regex/validation for the employee form:
const regexPatterns = {
    employeeName: /^[a-zA-Z\s]+$/,
    address: /^[a-zA-Z0-9\s,.'-]{3,}$/,
    city: /^[a-zA-Z\s]+$/,
    state: /^[a-zA-Z\s]+$/,
    country: /^[a-zA-Z\s]+$/,
    phone: /^[0-9]{10}$/,
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/
};

function validateInput(input, pattern) {
    if (pattern.test(input.value)) { //testing input against regex 
        input.setCustomValidity('');
    } else {
        input.setCustomValidity('Invalid'); 
    }
}

//adding input listeners to each input field and calling validateInput to compare input w/ regex from the array
document.getElementById('employeeName').addEventListener('input', function () {
    validateInput(this, regexPatterns.employeeName);
});
document.getElementById('address').addEventListener('input', function () {
    validateInput(this, regexPatterns.address);
});
document.getElementById('city').addEventListener('input', function () {
    validateInput(this, regexPatterns.city);
});
document.getElementById('state').addEventListener('input', function () {
    validateInput(this, regexPatterns.state);
});
document.getElementById('country').addEventListener('input', function () {
    validateInput(this, regexPatterns.country);
});
document.getElementById('phone').addEventListener('input', function () {
    validateInput(this, regexPatterns.phone);
});
document.getElementById('email').addEventListener('input', function () {
    validateInput(this, regexPatterns.email);
});

//to add more passengers to form if needed:
function addPassengerForm() {
    const passengerDiv = document.createElement('div'); //creating new div to put the input fields
    passengerDiv.className = 'passenger-form';
    passengerDiv.innerHTML = `
        <hr>
        <div class="mb-3">
            <label for="employeeName" class="form-label">Employee Name</label>
            <input type="text" class="form-control" name="employeeName" required>
        </div>
        <div class="mb-3">
            <label for="address" class="form-label">Address</label>
            <input type="text" class="form-control" name="address" required>
        </div>
        <div class="mb-3">
            <label for="city" class="form-label">City</label>
            <input type="text" class="form-control" name="city" required>
        </div>
        <div class="mb-3">
            <label for="state" class="form-label">State/Province</label>
            <input type="text" class="form-control" name="state" required>
        </div>
        <div class="mb-3">
            <label for="country" class="form-label">Country</label>
            <input type="text" class="form-control" name="country" required>
        </div>
        <div class="mb-3">
            <label for="phone" class="form-label">Phone</label>
            <input type="tel" class="form-control" name="phone" required>
        </div>
        <div class="mb-3">
            <label for="email" class="form-label">Email</label>
            <input type="email" class="form-control" name="email" required>
        </div>
    `;
    document.getElementById('passengerDetails').appendChild(passengerDiv); //append div to passengerDetails
    passengerDiv.style.display = 'block'; //make div visible

    //more input listeners for real-time validation
    passengerDiv.querySelector('[name="employeeName"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.employeeName);
    });
    passengerDiv.querySelector('[name="address"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.address);
    });
    passengerDiv.querySelector('[name="city"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.city);
    });
    passengerDiv.querySelector('[name="state"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.state);
    });
    passengerDiv.querySelector('[name="country"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.country);
    });
    passengerDiv.querySelector('[name="phone"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.phone);
    });
    passengerDiv.querySelector('[name="email"]').addEventListener('input', function () {
        validateInput(this, regexPatterns.email);
    });
}
//event listener for add passenger button to add new set of input fields ^^
document.getElementById('addPassengerBtn').addEventListener('click', addPassengerForm);

//event listener for submitting the booking form
document.getElementById('bookingForm').addEventListener('submit', function (event) {
    event.preventDefault(); //preventing default submission behaviour that would reload the page
    
    //making sure form is valid
    if (!this.checkValidity()) {
        event.stopPropagation(); //if not valid, stops forms event from moving forward
    } else {// else: retrieve data from all input fields and store in array 'passengers'
        const passengers = Array.from(document.querySelectorAll('.passenger-form')).map(passengerForm => {
            const passenger = {
                employeeName: passengerForm.querySelector('[name="employeeName"]').value,
                address: passengerForm.querySelector('[name="address"]').value,
                city: passengerForm.querySelector('[name="city"]').value,
                state: passengerForm.querySelector('[name="state"]').value,
                country: passengerForm.querySelector('[name="country"]').value,
                phone: passengerForm.querySelector('[name="phone"]').value,
                email: passengerForm.querySelector('[name="email"]').value
            };
            return passenger;
        });
        
        //putting collected data into bookingDetails
        const bookingDetails = {
            passengers: passengers
        };
        

        displayBookingConfirmation(bookingDetails);
        this.reset(); //reset form fields
        $('#bookingModal').modal('hide'); //hide form modal
    }
    this.classList.add('was-validated'); //for ""visual feedback"" with the validation on forms
});
document.getElementById('bookingConfirmation').style.display = 'none';

function displayBookingConfirmation(bookingDetails) {
    document.getElementById('map').style.display = 'none'; //hide map
    document.getElementById('flightsContainer').style.display = 'none'; //hide flights (this is so only the booking info is displayed)
    document.getElementById('locateMe').style.display = 'none';

    //display booking information:
    const bookingConfirmation = document.getElementById('bookingConfirmation');
    bookingConfirmation.style.display = 'block';

    //calculates total number of seats booked - using .reduce it iterates over each item in cartItems and sums up the number of seats, ensuring at least one seat per flight is the default. (if not specified it counts from zero)
    const totalSeatsBooked = cartItems.reduce((total, flight) => total + (flight.seats_booked || 1), 0);

    //getting passenger info 
    const passengerInfo = document.getElementById('passengerInfo');
    let passengerHTML = `<h3>Number of passengers: ${totalSeatsBooked}</h3>`;
    // loop through each passenger in the bookingDetails and append their info to passengerInfo
    bookingDetails.passengers.forEach((passenger, index) => {
        passengerHTML += `
            <h4>Passenger: <span style="color: blue;"> ${index + 1}</span></h4>
            <p>Employee Name: <span style="color: blue;">${passenger.employeeName}</span></p>
            <p>Employee Address:<span style="color: blue;"> ${passenger.address}, ${passenger.city}, ${passenger.state}, ${passenger.country}</span></p>
            <p>Phone Number: <span style="color: blue;">${passenger.phone}</span></p>
            <p>Email:<span style="color: blue;"> ${passenger.email}</span></p>
            <hr>
        `;
    });
    passengerInfo.innerHTML = passengerHTML;
    
    //initialise totalCost
    let totalCostToCompany = 0;
    const flightInfo = document.getElementById('flightInfo'); //flight information display
    flightInfo.innerHTML = '<h3>Flight Details:</h3>';
    // loop through each flight in the cartItems, calculate the total cost, and append the info to flightInfo
    cartItems.forEach((flight, index) => {
        const flightCost = calculateTotalCost(flight) * (flight.seats_booked || 1); //multiply by seats booked, if invalid number use 1
        totalCostToCompany += flightCost;
        flightInfo.innerHTML += `
            <h4>Flight ${index + 1}:</h4>
            <p>Destination: <span style="color: blue;">${flight.destination}</span></p>
            <p>Departure: <span style="color: blue;">${selectedAirports[0] ? selectedAirports[0].airport['City Name'] : 'N/A'}</span></p>
            <p>Cost per Flight:<span style="color: blue;"> $${calculateTotalCost(flight)}</span></p>
            <p>Extra Fuel Charge (if applicable): <span style="color: blue;"> ${flight.weather === 'rain' ? `$${flight.extraFuelCharge}` : 'N/A'}</span></p>
            <p>Total Cost:<span style="color: blue;"> $${flightCost.toFixed(2)}</span></p>
            <hr>
            
        `;
    });
    
    flightInfo.innerHTML += `<h4>Total Cost to Company: <span style="color: magenta;"> $${totalCostToCompany.toFixed(2)}</span></h4>`;

    cartItems.length = 0;
    updateCart();
}

function calculateOrderDetails(bookingDetails) {
    //summing up the total costs of all flights in the cart
    const orderSubtotal = cartItems.reduce((subtotal, flight) => subtotal + parseFloat(calculateTotalCost(flight)), 0);
    const totalSeatsBooked = bookingDetails.passengers.length; //calculate total number of seats booked (passengers.length)
    const totalCostToCompany = totalSeatsBooked * orderSubtotal; //total cost to company
    return { orderSubtotal, totalSeatsBooked, totalCostToCompany };
}

    //event listener for confirm booking button 
    document.getElementById('submitBookingBtn').addEventListener('submit', () => {
        cartItems.length = 0; //reset cartItems array
        updateCart();
        //reset to initial state 
        document.getElementById('bookingForm').reset(); 
        document.getElementById('bookingForm').classList.remove('was-validated');
        $('#bookingConfirmationModal').modal('hide');
    });

