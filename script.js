// Menu Toggle Functionality
const menuToggle = document.getElementById('menuToggle');
const menu = document.getElementById('menu');
const overlay = document.getElementById('overlay');

if (menuToggle && menu && overlay) {
    menuToggle.addEventListener('click', () => {
        menu.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        menu.classList.remove('active');
        overlay.classList.remove('active');
    });
}

// Location Selector Functionality
const addressBar = document.getElementById("addressBar");
const locationPopup = document.getElementById("locationPopup");
const useCurrentLocation = document.getElementById("useCurrentLocation");
const currentAddress = document.getElementById("currentAddress");
const addressIcon = document.getElementById("addressIcon");
const popupSearchInput = document.getElementById("popupSearchInput");
const confirmAddressBtn = document.getElementById("confirmAddressBtn");
const suggestionsBox = document.getElementById("suggestions");
const homeSearchInput = document.querySelector(".home-search input");
const locationLoading = document.getElementById("locationLoading");
const locationMessage = document.getElementById("locationMessage");
const mapError = document.getElementById("mapError");
const closePopup = document.getElementById("closePopup");

// Initialize variables for location functionality
let debounceTimer, cache = {}, selectedIndex = -1, currentSuggestions = [];
let map, marker, coords = null;

// Open location popup when address bar is clicked
if (addressBar && locationPopup) {
    addressBar.addEventListener("click", () => locationPopup.style.display = "flex");
    
    // Close popup when clicking outside the content
    locationPopup.addEventListener("click", e => {
        if (e.target === locationPopup) locationPopup.style.display = "none";
    });
}

// Close popup handler
closePopup.addEventListener("click", () => {
  locationPopup.style.display = "none";
});

// Function to set home icon in address bar
function setHomeIcon() {
    if (addressIcon) {
        addressIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="green" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z"/></svg>`;
    }
}

// Autocomplete search in location popup (enhanced for pincode and area/street)
if (popupSearchInput && suggestionsBox) {
    popupSearchInput.addEventListener("input", () => {
        const query = popupSearchInput.value.trim();
        clearTimeout(debounceTimer);
        selectedIndex = -1;
        
        // Clear suggestions if query is too short
        if (query.length < 2) {
            suggestionsBox.innerHTML = "";
            suggestionsBox.style.display = "none";
            return;
        }
        
        // Use cached results if available
        if (cache[query]) {
            renderSuggestions(cache[query]);
            return;
        }
        
        // Fetch location suggestions with debouncing
        debounceTimer = setTimeout(async () => {
            try {
                let data = [];
                // If query is 6 digits (pincode), use Indian pincode API
                if (/^\d{6}$/.test(query)) {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${query}`);
                    const pinData = await res.json();
                    if (pinData[0].Status === 'Success') {
                        data = pinData[0].PostOffice.map(po => ({
                            display_name: `${po.Name}, ${po.District}, ${po.State} (${po.Pincode})`
                        }));
                    }
                } else {
                    // For area/street/name, use Nominatim
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=in`);
                    data = await res.json();
                }
                cache[query] = data;
                renderSuggestions(data);
            } catch (err) {
                console.error(err);
            }
        }, 250);
    });
}

// Function to render location suggestions
function renderSuggestions(suggestions) {
    if (!suggestionsBox) return;
    
    currentSuggestions = suggestions;
    suggestionsBox.innerHTML = '';
    
    // Show message if no results found
    if (suggestions.length === 0) {
        suggestionsBox.innerHTML = "No results found";
        suggestionsBox.style.display = "block";
        return;
    }
    
    // Create suggestion items
    suggestions.forEach((item, i) => {
        const div = document.createElement("div");
        div.textContent = item.display_name;
        div.onclick = () => selectSuggestion(i);
        suggestionsBox.appendChild(div);
    });
    suggestionsBox.style.display = "block";
}

// Function to handle suggestion selection
function selectSuggestion(index) {
    const place = currentSuggestions[index];
    if (popupSearchInput) popupSearchInput.value = place.display_name;
    if (currentAddress) currentAddress.innerHTML = place.display_name;
    setHomeIcon();
    if (locationPopup) locationPopup.style.display = "none";
}

// Keyboard navigation for suggestions
if (popupSearchInput) {
    popupSearchInput.addEventListener("keydown", e => {
        const items = suggestionsBox ? suggestionsBox.querySelectorAll("div") : [];
        if (items.length === 0) return;
        
        // Navigate down with arrow down
        if (e.key === "ArrowDown") {
            selectedIndex = (selectedIndex + 1) % items.length;
            updateActive(items);
        } 
        // Navigate up with arrow up
        else if (e.key === "ArrowUp") {
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateActive(items);
        } 
        // Select with enter key
        else if (e.key === "Enter" && selectedIndex >= 0) {
            selectSuggestion(selectedIndex);
        }
    });
}

// Function to update active suggestion item
function updateActive(items) {
    items.forEach((item, i) => item.classList.toggle("active", i === selectedIndex));
}

// Use current location functionality
if (useCurrentLocation && currentAddress) {
    useCurrentLocation.addEventListener("click", () => {
        if (!navigator.geolocation) {
            alert("Geolocation not supported.");
            return;
        }
        
        currentAddress.innerHTML = "Detecting location...";
        locationLoading.style.display = "block";
        useCurrentLocation.style.display = "none";
        locationMessage.style.display = "block";
        mapError.style.display = "none";
        
        navigator.geolocation.getCurrentPosition(async pos => {
            coords = {lat: pos.coords.latitude, lng: pos.coords.longitude};
            try {
                await showMap(coords);
                await fetchAddress(coords);
                locationLoading.style.display = "none";
                useCurrentLocation.style.display = "flex";
                locationMessage.style.display = "none";
            } catch (error) {
                console.error("Map error:", error);
                locationLoading.style.display = "none";
                useCurrentLocation.style.display = "flex";
                locationMessage.style.display = "none";
                mapError.style.display = "block";
            }
        }, err => {
            // Handle geolocation errors
            switch (err.code) {
                case err.PERMISSION_DENIED:
                    currentAddress.innerHTML = "Permission denied.";
                    break;
               case err.POSITION_UNAVAILABLE:
                    currentAddress.innerHTML = "Location unavailable.";
                    break;
                case err.TIMEOUT:
                    currentAddress.innerHTML = "Request timed out.";
                    break;
                default:
                    currentAddress.innerHTML = "Unknown error.";
                    break;
            }
            locationLoading.style.display = "none";
            useCurrentLocation.style.display = "flex";
        });
    });
}

// Show map function
function showMap({lat, lng}) {
  return new Promise((resolve, reject) => {
    try {
      // Initialize map if not already done
      if (!map) {
        map = L.map("map").setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Create a custom icon for the marker
        const customIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
          shadowSize: [41, 41]
        });

        marker = L.marker([lat, lng], {icon: customIcon, draggable: true}).addTo(map);
        
        // Update address when marker is dragged
        marker.on("dragend", function() {
          const position = marker.getLatLng();
          coords = {lat: position.lat, lng: position.lng};
          fetchAddress(coords);
        });
      } else {
        map.setView([lat, lng], 15);
        marker.setLatLng([lat, lng]);
      }
      
      // Make sure the map container is visible
      document.getElementById("map").style.display = "block";
      
      // Small delay to ensure map renders properly
      setTimeout(() => {
        map.invalidateSize();
        resolve();
      }, 100);
    } catch (error) {
      console.error("Error initializing map:", error);
      mapError.style.display = "block";
      reject(error);
    }
  });
}

// Fetch address from coordinates
async function fetchAddress({lat, lng}) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
    
    if (!res.ok) {
      console.error('Geocoding API error:', res.status);
      return;
    }
    
    const data = await res.json();
    
    if (data && data.address) {
      popupSearchInput.value = data.display_name || "";
      currentAddress.innerHTML = data.display_name || "Current location";
      setHomeIcon();
    }
  } catch(err) { 
    console.error('Error with geocoding API:', err);
  }
}

// Confirm typed address
if (confirmAddressBtn && popupSearchInput && currentAddress) {
    confirmAddressBtn.addEventListener("click", () => {
        let val = popupSearchInput.value.trim();
        if (!val) {
            alert("Please enter a location.");
            return;
        }
        currentAddress.innerHTML = val;
        setHomeIcon();
        if (locationPopup) locationPopup.style.display = "none";
    });
}

// Grocery search placeholder rotation
const grocerySuggestions = ["Milk", "Bread", "Rice", "Eggs", "Butter", "Cheese", "Cheese", "Fruits", "Vegetables", "fashion", "beauty", "shampoo", "laptop", "biscuite", "chocleate"];
let groceryIndex = 0;

// Rotate placeholder text every 2 seconds
if (homeSearchInput) {
    setInterval(() => {
        homeSearchInput.setAttribute("placeholder", "Search for " + grocerySuggestions[groceryIndex]);
        groceryIndex = (groceryIndex + 1) % grocerySuggestions.length;
    }, 2000);
}

// Initialize Swiper for image carousel
let swiper = null;
if (document.querySelector('.swiper')) {
    swiper = new Swiper('.swiper', {
        loop: true,
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
    });
}

// Add click event to categories
document.querySelectorAll('.category').forEach(item => {
    item.addEventListener('click', function () {
        // Remove active class from all categories
        document.querySelectorAll('.category').forEach(cat => {
            cat.classList.remove('active');
        });
        // Add active class to clicked category
        this.classList.add('active');
    });
});

// Sample product data for each category with images
const productsData = {
'Fresh Fruits': [
    {
        name: 'Shimla Apple',
        price: '₹120/kg',
        originalPrice: '₹133/kg',
        discount: '10% OFF',
        description: 'Fresh and juicy Shimla apples with crisp texture and sweet-tart flavor. Rich in fiber and antioxidants.',
        image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.29.28_d4ac1c40.jpg'
    }
],
'Fresh Vegetables': [
    {
        name: 'Fresh Tomato',
        price: '₹40/kg',
        originalPrice: '₹45/kg',
        discount: '11% OFF',
        description: 'Fresh red tomatoes, perfect for salads and cooking.',
        image: 'images/fresh-tomato.jpg'
    }
],
'Organic Produce': [
    {
        name: 'Organic Spinach',
        price: '₹50/kg',
        originalPrice: '₹55/kg',
        discount: '9% OFF',
        description: 'Fresh organic spinach leaves, rich in vitamins.',
        image: 'images/organic-spinach.jpg'
    }
],
'Exotic Fruits': [
    {
        name: 'Dragon Fruit',
        price: '₹200/kg',
        originalPrice: '₹220/kg',
        discount: '9% OFF',
        description: 'Exotic dragon fruit with sweet taste and health benefits.',
        image: 'images/dragon-fruit.jpg'
    }
],
'Rice': [
    {
        name: 'India Gate Basmati Rice',
        price: '₹499',
        originalPrice: '₹550',
        discount: '9% OFF',
        description: 'Premium quality basmati rice with long grains and aromatic flavor. Perfect for biryanis and pulao.',
        image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.49.56_8eab8492.jpg'
    }
],
'Atta & Flour': [
    {
        name: 'Aashirvaad Whole Wheat Atta',
        price: '₹299',
        originalPrice: '₹330',
        discount: '9% OFF',
        description: '100% whole wheat atta with 0% maida. Rich in fiber and nutrients for healthy rotis.',
        image: '/photos/IMG-20250927-WA0044.jpg'
    }
],
'Pulses': [
    {
        name: 'Moong Dal',
        price: '₹150/kg',
        originalPrice: '₹165/kg',
        discount: '9% OFF',
        description: 'High quality moong dal, easy to digest and rich in protein.',
        image: 'images/moong-dal.jpg'
    }
],
'Oil & Ghee': [
    {
        name: 'Fortune Sunflower Oil',
        price: '₹199',
        originalPrice: '₹225',
        discount: '12% OFF',
        description: '100% pure sunflower oil with light taste and high smoke point. Rich in vitamin E.',
        image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.55.53_a1401894.jpg'
    }
],
'Sugar & Salt': [
    {
        name: 'Tata Iodized Salt',
        price: '₹25',
        originalPrice: '₹28',
        discount: '11% OFF',
        description: 'Pure and vacuum evaporated iodized salt. Essential for thyroid function and overall health.',
        image: '/photos/IMG-20250927-WA0047.jpg'
    }
],
'Dry Fruits': [
    {
        name: 'Almonds',
        price: '₹500/kg',
        originalPrice: '₹550/kg',
        discount: '9% OFF',
        description: 'Premium California almonds, rich in healthy fats and vitamins.',
        image: 'images/almonds.jpg'
    }
],
'Cleaning Supplies': [
    {
        name: 'Harpic Toilet Cleaner',
        price: '₹100',
        originalPrice: '₹110',
        discount: '9% OFF',
        description: 'Powerful toilet cleaner that kills 99.9% germs.',
        image: 'images/toilet-cleaner.jpg'
    }
],
'Detergents': [
    {
        name: 'Surf Excel Detergent',
        price: '₹200',
        originalPrice: '₹220',
        discount: '9% OFF',
        description: 'Removes tough stains in one wash.',
        image: 'images/detergent.jpg'
    }
],
'Kitchen Tools': [
    {
        name: 'Stainless Steel Knife Set',
        price: '₹300',
        originalPrice: '₹330',
        discount: '9% OFF',
        description: 'Sharp and durable knife set for kitchen use.',
        image: 'images/knife-set.jpg'
    }
],
'Paper Products': [
    {
        name: 'Tissue Paper Box',
        price: '₹50',
        originalPrice: '₹55',
        discount: '9% OFF',
        description: 'Soft and absorbent tissue papers.',
        image: 'images/tissue-paper.jpg'
    }
],
'Bath & Body': [
    {
        name: 'Dove Soap',
        price: '₹50',
        originalPrice: '₹55',
        discount: '9% OFF',
        description: 'Moisturizing soap for soft skin.',
        image: 'images/dove-soap.jpg'
    }
],
'Hair Care': [
    {
        name: 'Pantene Shampoo',
        price: '₹200',
        originalPrice: '₹220',
        discount: '9% OFF',
        description: 'Shampoo for smooth and shiny hair.',
        image: 'images/pantene-shampoo.jpg'
    }
],
'Skincare': [
    {
        name: 'Nivea Moisturizer',
        price: '₹150',
        originalPrice: '₹165',
        discount: '9% OFF',
        description: 'Daily moisturizer for hydrated skin.',
        image: 'images/nivea-moisturizer.jpg'
    }
],
'Makeup': [
    {
        name: 'Maybelline Lipstick',
        price: '₹300',
        originalPrice: '₹330',
        discount: '9% OFF',
        description: 'Long-lasting matte lipstick.',
        image: 'images/maybelline-lipstick.jpg'
    }
],
'Fragrances': [
    {
        name: 'Fogg Perfume',
        price: '₹250',
        originalPrice: '₹275',
        discount: '9% OFF',
        description: 'Long-lasting fresh fragrance.',
        image: 'images/fogg-perfume.jpg'
    }
],
'Oral Care': [
    {
        name: 'Colgate Toothpaste',
        price: '₹100',
        originalPrice: '₹110',
        discount: '9% OFF',
        description: 'Cavity protection toothpaste.',
        image: 'images/colgate-toothpaste.jpg'
    }
],
'Men\'s Grooming': [
    {
        name: 'Gillette Razor',
        price: '₹200',
        originalPrice: '₹220',
        discount: '9% OFF',
        description: 'Smooth shave razor.',
        image: 'images/gillette-razor.jpg'
    }
],
'Baby Care': [
    {
        name: 'Pampers Diapers',
        price: '₹500',
        originalPrice: '₹550',
        discount: '9% OFF',
        description: 'Soft and absorbent diapers.',
        image: 'images/pampers-diapers.jpg'
    }
],
'Mobiles': [
    {
        name: 'Samsung Galaxy S23',
        price: '₹79999',
        originalPrice: '₹89999',
        discount: '11% OFF',
        description: 'Flagship smartphone with excellent camera.',
        image: 'images/samsung-galaxy-s23.jpg'
    }
],
'Headphones': [
    {
        name: 'Sony WH-1000XM4',
        price: '₹24990',
        originalPrice: '₹29990',
        discount: '17% OFF',
        description: 'Noise-cancelling wireless headphones.',
        image: 'images/sony-headphones.jpg'
    }
],
'Speakers': [
    {
        name: 'JBL Flip 5',
        price: '₹7999',
        originalPrice: '₹8999',
        discount: '11% OFF',
        description: 'Portable Bluetooth speaker.',
        image: 'images/jbl-speaker.jpg'
    }
],
'Smart Watches': [
    {
        name: 'Apple Watch Series 8',
        price: '₹45900',
        originalPrice: '₹49900',
        discount: '8% OFF',
        description: 'Advanced smartwatch with health tracking.',
        image: 'images/apple-watch.jpg'
    }
],
'Laptops': [
    {
        name: 'Dell XPS 13',
        price: '₹129990',
        originalPrice: '₹139990',
        discount: '7% OFF',
        description: 'Premium ultrabook with InfinityEdge display.',
        image: 'images/dell-laptop.jpg'
    }
],
'Chargers': [
    {
        name: 'Anker PowerPort',
        price: '₹1499',
        originalPrice: '₹1699',
        discount: '12% OFF',
        description: 'Fast charging USB wall charger.',
        image: 'images/anker-charger.jpg'
    }
],
'Power Banks': [
    {
        name: 'Mi Power Bank 3i',
        price: '₹1999',
        originalPrice: '₹2199',
        discount: '9% OFF',
        description: '20000mAh power bank with fast charging.',
        image: 'images/mi-powerbank.jpg'
    }
],
'Home Appliances': [
    {
        name: 'LG Washing Machine',
        price: '₹24990',
        originalPrice: '₹29990',
        discount: '17% OFF',
        description: 'Front load washing machine with AI DD.',
        image: 'images/lg-washing-machine.jpg'
    }
],
'Baby Food': [
    {
        name: 'Nestle Cerelac',
        price: '₹250',
        originalPrice: '₹275',
        discount: '9% OFF',
        description: 'Infant cereal with iron and vitamins.',
        image: 'images/nestle-cerelac.jpg'
    }
],
'Baby Diapers': [
    {
        name: 'Pampers Diapers',
        price: '₹500',
        originalPrice: '₹550',
        discount: '9% OFF',
        description: 'Soft and absorbent diapers for babies.',
        image: 'images/pampers-diapers.jpg'
    }
],
'Baby Skincare': [
    {
        name: 'Johnson\'s Baby Lotion',
        price: '₹200',
        originalPrice: '₹220',
        discount: '9% OFF',
        description: 'Gentle moisturizer for baby skin.',
        image: 'images/johnsons-lotion.jpg'
    }
],
'Baby Wipes': [
    {
        name: 'Huggies Wipes',
        price: '₹150',
        originalPrice: '₹165',
        discount: '9% OFF',
        description: 'Soft and gentle baby wipes.',
        image: 'images/huggies-wipes.jpg'
    }
],
'Soft Toys': [
    {
        name: 'Teddy Bear',
        price: '₹300',
        originalPrice: '₹330',
        discount: '9% OFF',
        description: 'Cute and cuddly teddy bear.',
        image: 'images/teddy-bear.jpg'
    }
],
'Educational Toys': [
    {
        name: 'Lego Building Set',
        price: '₹1000',
        originalPrice: '₹1100',
        discount: '9% OFF',
        description: 'Creative building blocks for kids.',
        image: 'images/lego-set.jpg'
    }
],
'Games': [
    {
        name: 'Monopoly Board Game',
        price: '₹500',
        originalPrice: '₹550',
        discount: '9% OFF',
        description: 'Classic family board game.',
        image: 'images/monopoly-game.jpg'
    }
],
'Ride-ons': [
    {
        name: 'Kids Bicycle',
        price: '₹2000',
        originalPrice: '₹2200',
        discount: '9% OFF',
        description: 'Safe and fun bicycle for children.',
        image: 'images/kids-bicycle.jpg'
    }
],
    
    'Apples': [
        {
            name: 'Shimla Apple',
            price: '₹120/kg',
            originalPrice: '₹133/kg',
            discount: '10% OFF',
            description: 'Fresh and juicy Shimla apples with crisp texture and sweet-tart flavor. Rich in fiber and antioxidants.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.29.28_d4ac1c40.jpg'
        },
        {
            name: 'Washington Apple',
            price: '₹180/kg',
            originalPrice: '₹200/kg',
            discount: '10% OFF',
            description: 'Premium imported Washington apples with firm texture and sweet flavor. Perfect for snacking.',
            image: 'images/washington-apple.jpg'
        },
        {
            name: 'Kashmiri Apple',
            price: '₹150/kg',
            originalPrice: '₹165/kg',
            discount: '9% OFF',
            description: 'Sweet and aromatic Kashmiri apples with deep red color and crisp crisp.',
            image: 'images/kashmiri-apple.jpg'
        }
    ],
    'Bananas': [
        {
            name: 'Robusta Banana',
            price: '₹50/dozen',
            originalPrice: '₹55/dozen',
            discount: '9% OFF',
            description: 'Fresh and juicy Robusta bananas with perfect ripeness. Rich in potassium and natural sugars for energy.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.35.40_54dd1364.jpg'
        },
        {
            name: 'Yelakki Banana',
            price: '₹60/dozen',
            originalPrice: '₹65/dozen',
            discount: '8% OFF',
            description: 'Small and sweet Yelakki bananas, perfect for kids and healthy snacks.',
            image: 'images/yelakki-banana.jpg'
        }
    ],
    'Oranges': [
        {
            name: 'Fresh Orange',
            price: '₹80/kg',
            originalPrice: '₹85/kg',
            discount: '5% OFF',
            description: 'Juicy oranges rich in vitamin C. Perfect for fresh juice or snacking.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.39.40_78e6864a.jpg'
        }
    ],
    'Grapes': [
        {
            name: 'Green Grapes',
            price: '₹100/kg',
            originalPrice: '₹109/kg',
            discount: '8% OFF',
            description: 'Sweet and seedless green grapes. High in antioxidants.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.44.02_9659ed55.jpg'
        }
    ],
    'Rice': [
        {
            name: 'India Gate Basmati Rice',
            price: '₹499',
            originalPrice: '₹550',
            discount: '9% OFF',
            description: 'Premium quality basmati rice with long grains and aromatic flavor. Perfect for biryanis and pulao.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.49.56_8eab8492.jpg'
        },
        {
            name: 'Daawat Basmati Rice',
            price: '₹450',
            originalPrice: '₹500',
            discount: '10% OFF',
            description: 'Authentic basmati rice with extra long grains and non-sticky. Ideal for daily cooking.',
            image: 'images/daawat-rice.jpg'
        },
        {
            name: 'Fortune Basmati Rice',
            price: '₹420',
            originalPrice: '₹480',
            discount: '12% OFF',
            description: 'Pure basmati rice with excellent elongation and non-sticky texture. Good for all rice dishes.',
            image: 'images/fortune-rice.jpg'
        }
    ],
    'Oil': [
        {
            name: 'Fortune Sunflower Oil',
            price: '₹199',
            originalPrice: '₹225',
            discount: '12% OFF',
            description: '100% pure sunflower oil with light taste and high smoke point. Rich in vitamin E.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.55.53_a1401894.jpg'
        },
        {
            name: 'Saffola Gold Oil',
            price: '₹210',
            originalPrice: '₹240',
            discount: '12% OFF',
            description: 'Blended edible oil with extra of rice bran oil and sunflower oil. Helps maintain cholesterol.',
            image: 'images/saffola-oil.jpg'
        },
        {
            name: 'Patanjali Mustard Oil',
            price: '₹180',
            originalPrice: '₹200',
            discount: '10% OFF',
            description: 'Pure mustard oil with strong aroma and taste. Traditionally used in Indian cooking.',
            image: 'images/mustard-oil.jpg'
        }
    ],
    'Wheat': [
        {
            name: 'Aashirvaad Whole Wheat Atta',
            price: '₹299',
            originalPrice: '₹330',
            discount: '9% OFF',
            description: '100% whole wheat atta with 0% maida. Rich in fiber and nutrients for healthy rotis.',
            image: '/photos/IMG-20250927-WA0044.jpg'
        },
        {
            name: 'Pillsbury Chakki Fresh Atta',
            price: '₹280',
            originalPrice: '₹310',
            discount: '10% OFF',
            description: 'Chakki ground whole wheat flour for soft and fluffy rotis. Quick and easy to prepare.',
            image: 'images/pillsbury-atta.jpg'
        },
        {
            name: 'Nature\'s Gift Organic Wheat',
            price: '₹350',
            originalPrice: '₹380',
            discount: '8% OFF',
            description: 'Certified organic whole wheat flour. Grown without chemical fertilizers or pesticides.',
            image: 'images/organic-wheat.jpg'
        }
    ],
    'Salt': [
        {
            name: 'Tata Iodized Salt',
            price: '₹25',
            originalPrice: '₹28',
            discount: '11% OFF',
            description: 'Pure and vacuum evaporated iodized salt. Essential for thyroid function and overall health.',
            image: '/photos/IMG-20250927-WA0047.jpg'
        },
        {
            name: 'Saffola Salt',
            price: '₹30',
            originalPrice: '₹35',
            discount: '14% OFF',
            description: 'Low sodium salt with 15% less sodium than regular salt. Helps maintain blood pressure.',
            image: 'images/low-sodium-salt.jpg'
        }
    ],
    'Shampoo': [
        {
            name: 'Dove Shampoo',
            price: '₹250',
            originalPrice: '₹287',
            discount: '15% OFF',
            description: 'Nourishing shampoo for smooth and shiny hair. Repairs damage and prevents split ends.',
            image: '/photos/IMG-20250927-WA0025.jpg'
        }
    ],
    'Soap': [
        {
            name: 'Lux Soap',
            price: '₹50',
            originalPrice: '₹55',
            discount: '10% OFF',
            description: 'Luxurious soap with floral fragrance. Moisturizes skin and leaves it soft.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2017.59.53_58c12107.jpg'
        }
    ],
    'Toothpaste': [
        {
            name: 'Colgate Toothpaste',
            price: '₹100',
            originalPrice: '₹105',
            discount: '5% OFF',
            description: 'Cavity protection toothpaste with fluoride. Keeps teeth strong and healthy.',
            image: 'images/colgate-toothpaste.jpg'
        }
    ],
    'Face Wash': [
        {
            name: 'Neutrogena Face Wash',
            price: '₹200',
            originalPrice: '₹250',
            discount: '20% OFF',
            description: 'Oil-free face wash that deeply cleanses without drying the skin.',
            image: 'images/neutrogena-face-wash.jpg'
        }
    ],
    'Kids': [
        {
            name: 'Kids T-Shirt',
            price: '₹300',
            originalPrice: '₹333',
            discount: '10% OFF',
            description: 'Comfortable cotton t-shirt for kids with fun prints.',
            image: 'images/kids-tshirt.jpg'
        },
        {
            name: 'Kids Shoes',
            price: '₹500',
            originalPrice: '₹588',
            discount: '15% OFF',
            description: 'Durable and comfortable shoes for active kids.',
            image: 'images/kids-shoes.jpg'
        },
        {
            name: 'Kids Backpack',
            price: '₹400',
            originalPrice: '₹455',
            discount: '12% OFF',
            description: 'Spacious backpack with cartoon designs for school.',
            image: 'images/kids-backpack.jpg'
        },
        {
            name: 'Kids Hat',
            price: '₹150',
            originalPrice: '₹158',
            discount: '5% OFF',
            description: 'Cute hat to protect from sun.',
            image: 'images/kids-hat.jpg'
        }
    ],
    'Toys': [
        {
            name: 'Toy Car',
            price: '₹200',
            originalPrice: '₹222',
            discount: '10% OFF',
            description: 'Remote control toy car for endless fun.',
            image: 'images/toy-car.jpg'
        },
        {
            name: 'Doll',
            price: '₹9',
            originalPrice: '₹9.78',
            discount: '8% OFF',
            description: 'Beautiful doll with accessories.',
            image: '/photos/IMG-20250927-WA0035.jpg'
        },
        {
            name: 'Building Blocks',
            price: '₹300',
            originalPrice: '₹353',
            discount: '15% OFF',
            description: 'Colorful blocks for creative play.',
            image: '/photos/IMG-20250927-WA0036.jpg'
        },
        {
            name: 'Puzzle',
            price: '₹150',
            originalPrice: '₹158',
            discount: '5% OFF',
            description: 'Educational puzzle game.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2019.38.55_031856f6.jpg'
        }
    ],
    'Tea': [
        {
            name: 'Sony WH-1000XM4',
            price: '₹24,990',
            originalPrice: '₹29,990',
            discount: '17% OFF',
            description: 'Industry-leading noise cancellation headphones.',
            image: 'images/sony-headphones.jpg'
        },
        {
            name: 'Boat Rockerz 450',
            price: '₹1,499',
            originalPrice: '₹1,999',
            discount: '25% OFF',
            description: 'Comfortable wireless headphones with good sound.',
            image: 'images/boat-headphones.jpg'
        }
    ],
    'Electronic': [
        {
            name: 'Battery',
            price: '₹15',
            originalPrice: '₹15.15',
            discount: '1% OFF',
            description: 'High-performance smartphone with latest features.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2022.19.42_1d919744.jpg'
        },
        {
            name: 'Ear buds',
            price: '₹1,499',
            originalPrice: '₹1,998.67',
            discount: '25% OFF',
            description: 'Wireless earphones with noise cancellation.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2022.27.39_def69990.jpg'
        },
        {
            name: 'Smartphone',
            price: '₹15000',
            originalPrice: '₹16667',
            discount: '10% OFF',
            description: 'High-performance smartphone with latest features.',
            image: 'images/smartphone.jpg'
        },
        {
            name: 'Earphones',
            price: '₹482',
            originalPrice: '₹535.56',
            discount: '10% OFF',
            description: 'Wireless earphones with noise cancellation.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2022.27.39_07e6086e.jpg'
        }
    ],
    'Top Deals': [
        {
            name: 'Honey',
            price: '₹354',
            originalPrice: '₹393.33',
            discount: '10% OFF',
            description: 'Amazing deal on product 1.',
            image: '/photos/WhatsApp%20Image%202025-09-29%20at%2022.39.27_f2d922dc.jpg'
        },
        {
            name: 'Deal Product 2',
            price: '₹200',
            originalPrice: '₹266.67',
            discount: '25% OFF',
            description: 'Great savings on product 2.',
            image: 'images/deal2.jpg'
        },
        {
            name: 'Deal Product 3',
            price: '₹300',
            originalPrice: '₹375',
            discount: '20% OFF',
            description: 'Limited time offer on product 3.',
            image: 'images/deal3.jpg'
        },
        {
            name: 'Deal Product 4',
            price: '₹400',
            originalPrice: '₹470.59',
            discount: '15% OFF',
            description: 'Best deal on product 4.',
            image: 'images/deal4.jpg'
        }
    ],
    'Noodles': [
        {
            name: 'Maggi Masala Noodles',
            price: '₹60',
            originalPrice: '₹70',
            discount: '14% OFF',
            description: 'Instant noodles with masala tastemaker. Ready in just 2 minutes. Contains no added MSG.',
            image: 'images/maggi-noodles.jpg'
        },
        {
            name: 'Top Ramen Noodles',
            price: '₹55',
            originalPrice: '₹65',
            discount: '15% OFF',
            description: 'Delicious instant noodles with vegetable tastemaker. Quick and easy to prepare.',
            image: 'images/top-ramen.jpg'
        }
    ],
    'Milk': [
        {
            name: 'Amul Taaza Milk',
            price: '₹60',
            originalPrice: '',
            discount: '',
            description: 'Pasteurized standardized toned milk. Rich in calcium and protein. 4.5% fat content.',
            image: 'images/amul-milk.jpg'
        },
        {
            name: 'Mother Dairy Milk',
            price: '₹58',
            originalPrice: '',
            discount: '',
            description: 'Pure and fresh toned milk. Homogenized and pasteurized for safety and longer shelf life.',
            image: 'images/mother-dairy-milk.jpg'
        }
    ]
};

// Global variables for app state
let currentCategory = '';
let currentProduct = null;
let wishlistItems = [];
let cartItems = [];
let orders = [];
let totalAmount = 0;

// NEW: Global pending variables
let pendingAddToCartProduct = null;
let pendingPlaceOrder = false;

// Function to show products for a specific category
function showProducts(category) {
    currentCategory = category;
    document.body.classList.add('products-page-open');
    document.getElementById('categories-page').classList.add('hidden');
    document.getElementById('categories-grid-page').classList.add('hidden');
    document.getElementById('product-detail-page').classList.add('hidden');
    document.getElementById('wishlist-page').classList.add('hidden');
    document.getElementById('cart-page').classList.add('hidden');
    document.getElementById('orders-page').classList.add('hidden');
    document.getElementById('payment-page').classList.add('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('order-detail-page').classList.add('hidden');
    document.getElementById('products-page').classList.remove('hidden');

    document.getElementById('header-section').style.display = 'block'; // Ensure header is shown
    document.getElementById('app-footer').style.display = 'none'; // Hide footer

    // Set the category title
    document.getElementById('product-category-title').textContent = category;

    // Get the product grid container
    const productGrid = document.getElementById('products-grid');
    productGrid.innerHTML = '';

    // Check if we have products for this category
    if (productsData[category]) {
        // Add products to the grid
        productsData[category].forEach((product, index) => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.onclick = () => showProductDetail(category, index);

            // Check if product is in wishlist
            const isInWishlist = wishlistItems.some(item => item.name === product.name);

            // Check if product is in cart
            const cartItem = cartItems.find(item => item.name === product.name);
            const quantity = cartItem ? cartItem.quantity : 0;

            // Create product card HTML
            productCard.innerHTML = `
                <button class="wishlist ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(event, this, '${category}', ${index})" aria-pressed="${isInWishlist}" title="Add to wishlist">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M12.001 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12.001 21.35z"/>
                    </svg>
                </button>
                <div class="product-image-container">
                    <img src="${product.image}" class="product-image" alt="${product.name}">
                </div>
                <div class="product-info">
                    <div class="product-title">${product.name}</div>
                    <div class="product-price">${product.price}</div>
                    <div class="bottom-row">
                        <span class="discount-text">${product.discount}</span>
                        ${quantity > 0 ?
                `<div class="qty-control">
                            <button onclick="decreaseQty(event, this, '${product.name}')">-</button>
                            <span>${quantity}</span>
                            <button onclick="increaseQty(event, this, '${product.name}')">+</button>
                          </div>` :
                `<div class="add-btn" onclick="addToCart(event, this, '${product.name}')">ADD</div>`}
                    </div>
                </div>
            `;

            productGrid.appendChild(productCard);
        });
    } else {
        // If no products found for this category
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No products found for this category.';
        productGrid.appendChild(emptyState);
    }
    updateCartCount(); // Update visibility

    // Push to history
    history.pushState({page: 'products', category: category}, '', '?page=products&category=' + category);
}

// Function to show product detail page
function showProductDetail(category, productIndex) {
    currentCategory = category; // Update current category
    currentProduct = productsData[category][productIndex];
    document.body.classList.add('products-page-open');  // <-- Add this line to apply the hiding CSS
    document.getElementById('categories-page').classList.add('hidden');
    document.getElementById('categories-grid-page').classList.add('hidden');
    document.getElementById('products-page').classList.add('hidden');
    document.getElementById('wishlist-page').classList.add('hidden');
    document.getElementById('cart-page').classList.add('hidden');
    document.getElementById('orders-page').classList.add('hidden');
    document.getElementById('payment-page').classList.add('hidden');
    document.getElementById('profile-page').classList.add('hidden');
    document.getElementById('order-detail-page').classList.add('hidden');
    document.getElementById('product-detail-page').classList.remove('hidden');

    document.getElementById('header-section').style.display = 'block'; // Ensure header is shown
    document.getElementById('app-footer').style.display = 'none'; // Hide footer

        // Set product details
        document.getElementById('detail-product-image').src = currentProduct.image;
        document.getElementById('detail-product-image').alt = currentProduct.name;
        document.getElementById('detail-product-title').textContent = currentProduct.name;
        document.getElementById('detail-product-price').textContent = currentProduct.price;
        document.getElementById('detail-product-discount').textContent = currentProduct.discount;
        document.getElementById('detail-product-description').textContent = currentProduct.description;
        document.getElementById('detail-qty').textContent = '1';

        // Show related products (other products from same category excluding current)
        const relatedProductsGrid = document.getElementById('related-products-grid');
        relatedProductsGrid.innerHTML = '';

        if (productsData[category]) {
            productsData[category].forEach((product, index) => {
                if (product.name !== currentProduct.name) { // Don't show current product in related
                    const productCard = document.createElement('div');
                    productCard.className = 'product-card';
                    productCard.onclick = () => {
                        // Update current product details without reloading page
                        currentProduct = productsData[category][index];
                        document.getElementById('detail-product-image').src = currentProduct.image;
                        document.getElementById('detail-product-image').alt = currentProduct.name;
                        document.getElementById('detail-product-title').textContent = currentProduct.name;
                        document.getElementById('detail-product-price').textContent = currentProduct.price;
                        document.getElementById('detail-product-discount').textContent = currentProduct.discount;
                        document.getElementById('detail-product-description').textContent = currentProduct.description;
                        document.getElementById('detail-qty').textContent = '1';

                        // Scroll to top of product detail
                        window.scrollTo(0, 0);
                    };

                    // Check if product is in cart
                    const cartItem = cartItems.find(item => item.name === product.name);
                    const quantity = cartItem ? cartItem.quantity : 0;

                    productCard.innerHTML = `
                        <button class="wishlist" onclick="toggleWishlist(event, this, '${category}', ${index})" aria-pressed="false" title="Add to wishlist">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M12.001 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12.001 21.35z"/>
                            </svg>
                        </button>
                        <div class="product-image-container">
                            <img src="${product.image}" class="product-image" alt="${product.name}">
                        </div>
                        <div class="product-info">
                            <div class="product-title">${product.name}</div>
                            <div class="product-price">${product.price}</div>
                            <div class="bottom-row">
                                <span class="discount-text">${product.discount}</span>
                                ${quantity > 0 ?
                        `<div class="qty-control">
                                    <button onclick="decreaseQty(event, this, '${product.name}')">-</button>
                                    <span>${quantity}</span>
                                    <button onclick="increaseQty(event, this, '${product.name}')">+</button>
                                  </div>` :
                        `<div class="add-btn" onclick="addToCart(event, this, '${product.name}')">ADD</div>`}
                            </div>
                        </div>
                    `;

                    relatedProductsGrid.appendChild(productCard);
                }
            });
        }
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'product-detail', category: category, productIndex: productIndex}, '', '?page=product-detail&category=' + category + '&productIndex=' + productIndex);
    }

    // Function to show categories page
    function showCategories() {
        document.body.classList.remove('products-page-open');
        document.getElementById('products-page').classList.add('hidden');
        document.getElementById('categories-grid-page').classList.add('hidden');
        document.getElementById('product-detail-page').classList.add('hidden');
        document.getElementById('wishlist-page').classList.add('hidden');
        document.getElementById('cart-page').classList.add('hidden');
        document.getElementById('orders-page').classList.add('hidden');
        document.getElementById('payment-page').classList.add('hidden');
        document.getElementById('profile-page').classList.add('hidden');
        document.getElementById('order-detail-page').classList.add('hidden');
        document.getElementById('categories-page').classList.remove('hidden');
        document.getElementById('header-section').style.display = 'block'; // Ensure header is shown

        document.getElementById('app-footer').style.display = 'block';
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'categories'}, '', '?page=categories');
    }

    // Function to show categories grid page
    function showCategoriesGrid() {
        document.body.classList.add('products-page-open'); // Changed to add
        document.getElementById('products-page').classList.add('hidden');
        document.getElementById('categories-page').classList.add('hidden');
        document.getElementById('product-detail-page').classList.add('hidden');
        document.getElementById('wishlist-page').classList.add('hidden');
        document.getElementById('cart-page').classList.add('hidden');
        document.getElementById('orders-page').classList.add('hidden');
        document.getElementById('payment-page').classList.add('hidden');
        document.getElementById('profile-page').classList.add('hidden');
        document.getElementById('order-detail-page').classList.add('hidden');
        document.getElementById('categories-grid-page').classList.remove('hidden');
        document.getElementById('header-section').style.display = 'block';

        document.getElementById('app-footer').style.display = 'none';

        // Close menu if open
        if (menu && overlay) {
            menu.classList.remove('active');
            overlay.classList.remove('active');
        }
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'categories-grid'}, '', '?page=categories-grid');
    }

    // Function to show wishlist page
    function showWishlist() {
        document.body.classList.add('products-page-open');
        document.getElementById('categories-page').classList.add('hidden');
        document.getElementById('categories-grid-page').classList.add('hidden');
        document.getElementById('products-page').classList.add('hidden');
        document.getElementById('product-detail-page').classList.add('hidden');
        document.getElementById('cart-page').classList.add('hidden');
        document.getElementById('orders-page').classList.add('hidden');
        document.getElementById('payment-page').classList.add('hidden');
        document.getElementById('profile-page').classList.add('hidden');
        document.getElementById('order-detail-page').classList.add('hidden');
        document.getElementById('wishlist-page').classList.remove('hidden');

        document.getElementById('header-section').style.display = 'block';

        document.getElementById('app-footer').style.display = 'none';

        // Close menu if open
        if (menu && overlay) {
            menu.classList.remove('active');
            overlay.classList.remove('active');
        }

        // Update wishlist count
        document.getElementById('wishlist-count').textContent = wishlistItems.length;

        // Display wishlist items
        const wishlistGrid = document.getElementById('wishlist-grid');
        wishlistGrid.innerHTML = '';

        if (wishlistItems.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Your wishlist is empty.';
            wishlistGrid.appendChild(emptyState);
        } else {
            wishlistItems.forEach((product, index) => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                productCard.onclick = () => {
                    // Find the category of this product
                    let category = '';
                    for (const cat in productsData) {
                        if (productsData[cat].some(p => p.name === product.name)) {
                            category = cat;
                            break;
                        }
                    }

                    // Find the product index in its category
                    const productIndex = productsData[category].findIndex(p => p.name === product.name);

                    // Show product detail
                    showProductDetail(category, productIndex);
                };

                // Check if product is in cart
                const cartItem = cartItems.find(item => item.name === product.name);
                const quantity = cartItem ? cartItem.quantity : 0;

                productCard.innerHTML = `
                    <button class="wishlist active" onclick="toggleWishlist(event, this, '${product.category}', ${product.index})" aria-pressed="true" title="Remove from wishlist">
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M12.001 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12.001 21.35z"/>
                        </svg>
                    </button>
                    <div class="product-image-container">
                        <img src="${product.image}" class="product-image" alt="${product.name}">
                    </div>
                    <div class="product-info">
                        <div class="product-title">${product.name}</div>
                        <div class="product-price">${product.price}</div>
                        <div class="bottom-row">
                            <span class="discount-text">${product.discount}</span>
                            ${quantity > 0 ?
                    `<div class="qty-control">
                                <button onclick="decreaseQty(event, this, '${product.name}')">-</button>
                                <span>${quantity}</span>
                                <button onclick="increaseQty(event, this, '${product.name}')">+</button>
                              </div>` :
                    `<div class="add-btn" onclick="addToCart(event, this, '${product.name}')">ADD</div>`}
                        </div>
                    </div>
                `;

                wishlistGrid.appendChild(productCard);
            });
        }
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'wishlist'}, '', '?page=wishlist');
    }

    // Function to show cart page
    function showCart() {
        document.body.classList.add('products-page-open');
        document.getElementById('categories-page').classList.add('hidden');
        document.getElementById('categories-grid-page').classList.add('hidden');
        document.getElementById('products-page').classList.add('hidden');
        document.getElementById('product-detail-page').classList.add('hidden');
        document.getElementById('wishlist-page').classList.add('hidden');
        document.getElementById('orders-page').classList.add('hidden');
        document.getElementById('payment-page').classList.add('hidden');
        document.getElementById('profile-page').classList.add('hidden');
        document.getElementById('order-detail-page').classList.add('hidden');
        document.getElementById('cart-page').classList.remove('hidden');

        document.getElementById('header-section').style.display = 'block';

        document.getElementById('app-footer').style.display = 'none';

        // Close menu if open
        if (menu && overlay) {
            menu.classList.remove('active');
            overlay.classList.remove('active');
        }

        // Update cart count
        updateCartCount();

        // Display cart items
        const cartContainer = document.getElementById('cart-items');
        cartContainer.innerHTML = '';

        if (cartItems.length === 0) {
            cartContainer.innerHTML = `
                <div class="empty-state">
                    <p>Your cart is empty</p>
                    <button onclick="showCategories()" class="continue-shopping-btn">Continue Shopping</button>
                </div>
            `;
            document.querySelector('.bill-details').style.display = 'none';
            document.querySelector('.checkout-btn').style.display = 'none';
        } else {
            document.querySelector('.bill-details').style.display = 'block';
            document.querySelector('.checkout-btn').style.display = 'block';

            cartItems.forEach((item, index) => {
                const cartItem = document.createElement('div');
                cartItem.className = 'cart-item';
                cartItem.dataset.index = index;

                // Calculate price for this item
                const price = parseInt(item.price.replace(/[^0-9]/g, ''));
                const totalPrice = price * item.quantity;
                const originalPrice = item.originalPrice ? parseInt(item.originalPrice.replace(/[^0-9]/g, '')) * item.quantity : 0;

                cartItem.innerHTML = `
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.name}">
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-size">
                            ${item.size || '1 unit'}
                        </div>
                        <div class="cart-item-price">
                            ₹${totalPrice}
                            ${item.originalPrice ? `<span class="cart-item-original-price">₹${originalPrice}</span>` : ''}
                        </div>
                        <div class="cart-item-actions">
                            <button class="remove-item" onclick="removeFromCart(event, ${index})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#f44336">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                                Remove
                            </button>
                            <div class="qty-control">
                                <button onclick="decreaseCartQty(event, this)">-</button>
                                <span>${item.quantity}</span>
                                <button onclick="increaseCartQty(event, this)">+</button>
                            </div>
                        </div>
                    </div>
                `;

                cartContainer.appendChild(cartItem);
            });

            updateCartTotal();
        }
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'cart'}, '', '?page=cart');
    }

    // Function to show payment page
    function showPayment() {
        document.body.classList.add('products-page-open');
        document.getElementById('categories-page').classList.add('hidden');
        document.getElementById('categories-grid-page').classList.add('hidden');
        document.getElementById('products-page').classList.add('hidden');
        document.getElementById('product-detail-page').classList.add('hidden');
        document.getElementById('wishlist-page').classList.add('hidden');
        document.getElementById('cart-page').classList.add('hidden');
        document.getElementById('orders-page').classList.add('hidden');
        document.getElementById('profile-page').classList.add('hidden');
        document.getElementById('order-detail-page').classList.add('hidden');
        document.getElementById('payment-page').classList.remove('hidden');

        document.getElementById('header-section').style.display = 'block';

        document.getElementById('app-footer').style.display = 'none';

        document.querySelector('#payment-page .price').textContent = `₹${totalAmount}`;
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'payment'}, '', '?page=payment');
    }

    // Add to Cart Function
    function addToCart(event, button, productName = null) {
      if (event) event.stopPropagation();

      if (!isLoggedIn) {
        pendingAddToCartProduct = productName || currentProduct?.name;
        showLogin();
        return;
      }

      // Original addToCart logic...
      let product;
      if (productName) {
        // Find product by name
        for (const category in productsData) {
            const found = productsData[category].find(p => p.name === productName);
            if (found) {
                product = found;
                break;
            }
        }
      } else if (currentProduct) {
          product = currentProduct;
      } else {
          return;
      }

      if (!product) return;

      // Check if already in cart
      const existingItem = cartItems.find(item => item.name === product.name);

      if (existingItem) {
          existingItem.quantity += 1;
      } else {
          cartItems.push({
              ...product,
              quantity: 1,
              size: product.size || '1 unit'
          });
      }

      // Update button UI
      if (button) {
          button.outerHTML = `
              <div class="qty-control">
                  <button onclick="decreaseQty(event, this, '${product.name}')">-</button>
                  <span>${existingItem ? existingItem.quantity + 1 : 1}</span>
                  <button onclick="increaseQty(event, this, '${product.name}')">+</button>
              </div>
          `;
      }

      updateCartTotal(); // Updated to call updateCartTotal() for fast price update
      showToast(`${product.name} added to cart`);
  }

    // Quantity Controls
    function increaseQty(event, btn, productName) {
        event.stopPropagation();
        const item = cartItems.find(item => item.name === productName);
        if (item) {
            item.quantity += 1;
            btn.parentElement.querySelector("span").textContent = item.quantity;
            updateCartTotal();
        }
    }

    function decreaseQty(event, btn, productName) {
        event.stopPropagation();
        const itemIndex = cartItems.findIndex(item => item.name === productName);

        if (itemIndex >= 0) {
            if (cartItems[itemIndex].quantity <= 1) {
                // Remove from cart
                cartItems.splice(itemIndex, 1);

                // Reset all product buttons
                document.querySelectorAll('.product-card').forEach(card => {
                    if (card.querySelector('.product-title')?.textContent === productName) {
                        const qtyControl = card.querySelector('.qty-control');
                        if (qtyControl) {
                            qtyControl.outerHTML = '<div class="add-btn" onclick="addToCart(event, this, \'' + productName + '\')">ADD</div>';
                        }
                    }
                });
            } else {
                cartItems[itemIndex].quantity -= 1;
                btn.parentElement.querySelector("span").textContent = cartItems[itemIndex].quantity;
            }
            updateCartTotal();
        }

        if (document.getElementById('cart-page').classList.contains('hidden')) {
            updateCartCount();
        } else {
            showCart();
        }
    }

    // Cart Page Functions
    function removeFromCart(event, index) {
        event.stopPropagation();
        const removedItem = cartItems[index];
        cartItems.splice(index, 1);

        // Update product cards
        document.querySelectorAll('.product-card').forEach(card => {
            if (card.querySelector('.product-title')?.textContent === removedItem.name) {
                const qtyControl = card.querySelector('.qty-control');
                if (qtyControl) {
                    qtyControl.outerHTML = '<div class="add-btn" onclick="addToCart(event, this, \'' + removedItem.name + '\')">ADD</div>';
                }
            }
        });

        showCart();
    }

    function increaseCartQty(event, btn) {
        event.stopPropagation();
        const index = parseInt(btn.closest('.cart-item').dataset.index);
        if (!isNaN(index)) {
            cartItems[index].quantity += 1;
            btn.parentElement.querySelector("span").textContent = cartItems[index].quantity;
            updateCartTotal();
        }
    }

    function decreaseCartQty(event, btn) {
        event.stopPropagation();
        const index = parseInt(btn.closest('.cart-item').dataset.index);
        if (!isNaN(index)) {
            if (cartItems[index].quantity <= 1) {
                removeFromCart(event, index);
            } else {
                cartItems[index].quantity -= 1;
                btn.parentElement.querySelector("span").textContent = cartItems[index].quantity;
                updateCartTotal();
            }
        }
    }

    // Helper Functions
    function updateCartCount() {
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        document.getElementById('cart-count').textContent = totalItems;

        // Update new cart bar
        const cartBar = document.getElementById('cart-bar');
        if (cartBar) {
            if (!document.getElementById('cart-page').classList.contains('hidden') || !document.getElementById('payment-page').classList.contains('hidden') || totalItems === 0) {
                cartBar.style.display = 'none';
                document.getElementById('free-delivery-bar').style.display = 'none';  // Hide bar message too
            } else {
                cartBar.style.display = 'flex';
                // The message visibility is handled in updateCartTotal()
            }
            const itemsElem = cartBar.querySelector('.items');
            const priceElem = cartBar.querySelector('.price');
            if (itemsElem) itemsElem.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
            if (priceElem) priceElem.textContent = `₹${totalAmount}`;
        }
    }

    function updateCartTotal() {
        let itemsTotal = 0;
        let totalSaved = 0;

        // Calculate total price and savings
        cartItems.forEach(item => {
            const price = parseInt(item.price.replace(/[^0-9]/g, ''));
            itemsTotal += price * item.quantity;

            if (item.originalPrice) {
                const originalPrice = parseInt(item.originalPrice.replace(/[^0-9]/g, ''));
                totalSaved += (originalPrice - price) * item.quantity;
            }
        });

        // Define all fees
        const platformFee = 5;  // Platform fee ₹5
        const deliveryFee = (itemsTotal >= 299) ? 0 : 30; // Delivery fee ₹30 or free if >=299
        const handlingFee = 10; // Handling fee ₹10
        const additionalFees = platformFee + deliveryFee + handlingFee;
        const grandTotal = itemsTotal + additionalFees;

        totalAmount = grandTotal;

        // Update bill details section
        const billDetails = document.querySelector('.bill-details');
        if (billDetails) {
            billDetails.innerHTML = `
            <div class="bill-row">
                <span class="bill-label">Items (${cartItems.reduce((total, item) => total + item.quantity, 0)})</span>
                <span class="bill-value">₹${itemsTotal}</span>
            </div>
            <div class="bill-row">
                <span class="bill-label">Discount</span>
                <span class="bill-value saved">-₹${totalSaved}</span>
            </div>
            <div class="bill-row">
                <span class="bill-label">Platform fee</span>
                <span class="bill-value">₹${platformFee}</span>
            </div>
            <div class="bill-row">
                <span class="bill-label">Delivery fee</span>
                <span class="bill-value">${deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
            </div>
            <div class="bill-row">
                <span class="bill-label">Handling fee</span>
                <span class="bill-value">₹${handlingFee}</span>
            </div>
            <div class="bill-row grand-total">
                <span class="bill-label">Total Amount</span>
                <span class="bill-value">₹${grandTotal}</span>
            </div>
        `;
        }
        // Update BOTH free delivery messages
    const freeDeliveryMsgCart = document.getElementById('free-delivery-message');  // Cart page message
    const freeDeliveryMsgBar = document.getElementById('free-delivery-bar');  // New bar message

    if (freeDeliveryMsgCart && freeDeliveryMsgBar) {
        if (itemsTotal < 299) {
            const remaining = 299 - itemsTotal;
            const msg = `Shop for ₹${remaining} more to unlock FREE DELIVERY`;
            
            freeDeliveryMsgCart.textContent = msg;
            freeDeliveryMsgCart.style.display = 'block';
            
            freeDeliveryMsgBar.textContent = msg;
            freeDeliveryMsgBar.style.display = (cartItems.length > 0 && document.getElementById('cart-page').classList.contains('hidden')) ? 'block' : 'none';  // Show only if cart not empty and not in cart page
        } else {
            const msg = 'Congratulations! You have unlocked FREE DELIVERY';
            
            freeDeliveryMsgCart.textContent = msg;
            freeDeliveryMsgCart.style.display = 'block';
            
            freeDeliveryMsgBar.textContent = msg;
            freeDeliveryMsgBar.style.display = (cartItems.length > 0 && document.getElementById('cart-page').classList.contains('hidden')) ? 'block' : 'none';
        }
    }

    updateCartCount();
    }

    // Toast notification function
    function showToast(message){
      const toast = document.getElementById("toast");
      const toastMsg = document.getElementById("toastMessage");
      toastMsg.innerText = message;
      toast.classList.add("show");
      setTimeout(()=> toast.classList.remove("show"), 2500);
    }

    // Product detail quantity controls
    function increaseDetailQty() {
        let qty = document.getElementById('detail-qty');
        qty.textContent = parseInt(qty.textContent) + 1;
    }

    function decreaseDetailQty() {
        let qty = document.getElementById('detail-qty');
        let newQty = parseInt(qty.textContent) - 1;
        if (newQty < 1) newQty = 1;
        qty.textContent = newQty;
    }

    function addDetailToCart() {
        const quantity = parseInt(document.getElementById('detail-qty').textContent);

        for (let i = 0; i < quantity; i++) {
            addToCart(null, null, currentProduct.name);
        }

        // Show confirmation
        showToast(`${quantity} ${currentProduct.name} added to cart!`);
    }

    // Wishlist toggle function
    function toggleWishlist(event, el, category, index) {
        event.stopPropagation();
        el.classList.toggle('active');
        const isActive = el.classList.contains('active');
        el.setAttribute('aria-pressed', isActive);

        const product = productsData[category][index];
        const productData = {
            ...product,
            category,
            index
        };

        if (isActive) {
            // Add to wishlist
            if (!wishlistItems.some(item => item.name === product.name)) {
                wishlistItems.push(productData);

                // Show popup
                showToast("Added to wishlist");
            }
        } else {
            // Remove from wishlist
            wishlistItems = wishlistItems.filter(item => item.name !== product.name);

            // If we're on the wishlist page, refresh it
            if (!document.getElementById('wishlist-page').classList.contains('hidden')) {
                showWishlist();
            }
        }
    }

    // Search functionality
    const openSearch = document.getElementById("openSearch");
    const closeSearch = document.getElementById("closeSearch");
    const searchOverlay = document.getElementById("searchOverlay");
    const searchInput = document.getElementById("searchInput");

    if (openSearch && closeSearch && searchOverlay && searchInput) {
        openSearch.addEventListener("click", () => {
            searchOverlay.classList.add("active");
            setTimeout(() => searchInput.focus(), 0);
        });

        closeSearch.addEventListener("click", () => {
            searchOverlay.classList.remove("active");
        });
    }

    // Auto-detect location on page load
    document.addEventListener('DOMContentLoaded', function () {
        if (navigator.geolocation && currentAddress) {
            currentAddress.innerHTML = "Detecting location...";
            navigator.geolocation.getCurrentPosition(async pos => {
                const lat = pos.coords.latitude, lon = pos.coords.longitude;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    currentAddress.innerHTML = data.display_name || "Current location";
                    setHomeIcon();
                } catch (err) {
                    console.error(err);
                    currentAddress.innerHTML = "Select your delivery location...";
                }
            }, err => {
                console.error(err);
                currentAddress.innerHTML = "Select your delivery location...";
            });
        }
        
        // Open location popup on page load
        if (locationPopup) {
            locationPopup.style.display = "flex";
        }

        // Attach event to checkout button
        document.getElementById('checkoutBtn').addEventListener('click', showPayment);

        // Call payment init
        paymentInit();

        // Show footer initially
        document.getElementById('app-footer').style.display = "block";

        // Attach onclick to cart bar
        const cartBar = document.getElementById('cart-bar');
        if (cartBar) {
            cartBar.addEventListener('click', showCart);
        }

        updateProfileDisplay();

        // History management
        window.addEventListener('popstate', function(event) {
          if (event.state && event.state.page) {
            switch (event.state.page) {
              case 'categories':
                showCategories();
                break;
              case 'categories-grid':
                showCategoriesGrid();
                break;
              case 'products':
                showProducts(event.state.category);
                break;
              case 'product-detail':
                showProductDetail(event.state.category, event.state.productIndex);
                break;
              case 'wishlist':
                showWishlist();
                break;
              case 'cart':
                showCart();
                break;
              case 'payment':
                showPayment();
                break;
              case 'orders':
                showOrders();
                break;
              case 'order-detail':
                showOrderDetail(event.state.id);
                break;
              case 'profile':
                showProfile();
                break;
              default:
                showCategories();
            }
          } else {
            showCategories();
          }
        });

        // Initial push
        history.replaceState({page: 'categories'}, '', '?page=categories');

        // Populate featured sections dynamically
        populateFeaturedSections();
    });
    
    // NEW: Login System Variables
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    let userPhone = localStorage.getItem('userPhone') || '';
    let generatedOtp = null;

    // Function to show login popup
    function showLogin() {
      document.getElementById('loginPopup').style.display = 'flex';
      document.getElementById('phoneInput').focus();
    }

    // Function to hide login popup
    function hideLogin() {
        document.getElementById('loginPopup').style.display = 'none';
        document.getElementById('otpSection').style.display = 'none';
        document.getElementById('phoneInput').value = '';
        document.getElementById('otpInput').value = '';
        generatedOtp = null;
    }

    // Function to update UI based on login status
    function updateProfileDisplay() {
        if (isLoggedIn) {
            document.querySelector('.profile-header h2').textContent = `Welcome, ${userPhone}`;
            document.getElementById('loginBtn').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'block';
        } else {
            document.querySelector('.profile-header h2').textContent = 'Profile';
            document.getElementById('loginBtn').style.display = 'block';
            document.getElementById('logoutBtn').style.display = 'none';
        }
    }

    // Event Listeners for Login
    document.getElementById('closeLoginPopup').addEventListener('click', hideLogin);

    const phoneInput = document.getElementById('phoneInput');
    phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0,10);
        document.getElementById('sendOtpBtn').disabled = phoneInput.value.length !== 10;
    });

    document.getElementById('sendOtpBtn').addEventListener('click', () => {
        document.getElementById('loginLoading').style.display = 'block';
        setTimeout(() => {
            generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
            alert(`Your OTP is ${generatedOtp} (For demo purposes)`);
            document.getElementById('otpSection').style.display = 'block';
            document.getElementById('otpInput').focus();
            document.getElementById('loginLoading').style.display = 'none';
        }, 1000);
    });

    const otpInput = document.getElementById('otpInput');
    otpInput.addEventListener('input', () => {
        otpInput.value = otpInput.value.replace(/\D/g, '').slice(0,4);
        document.getElementById('verifyOtpBtn').disabled = otpInput.value.length !== 4;
    });

    document.getElementById('verifyOtpBtn').addEventListener('click', () => {
      if (otpInput.value === generatedOtp) {
        isLoggedIn = true;
        userPhone = phoneInput.value;
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userPhone', userPhone);
        hideLogin();
        showToast('Logged in successfully!');
        updateProfileDisplay();

        // Execute pending add to cart if any
        if (pendingAddToCartProduct) {
          addToCart(null, null, pendingAddToCartProduct);
          pendingAddToCartProduct = null;
        }

        // Execute pending place order if any
        if (pendingPlaceOrder) {
          placeOrder();
          pendingPlaceOrder = false;
        }

        showCategories(); // Proceed to home page after login
      } else {
        showToast('Invalid OTP. Please try again.');
      }
    });

    // Logout Function
    function logout() {
        isLoggedIn = false;
        userPhone = '';
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userPhone');
        showToast('Logged out successfully!');
        updateProfileDisplay();
        showCategories();
        // Additional cleanup if needed, e.g., clear cart or wishlist if required
    }

    // Modal functions for policies
    function openModal(type) {
        const modal = document.getElementById("policyModal");
        const title = document.getElementById("modalTitle");
        const content = document.getElementById("modalContent");

        if (modal && title && content) {
            if (type === "privacy") {
                title.innerText = "Privacy Policy";
                content.innerText = "This is a demo Privacy Policy. We respect your privacy and ensure your personal data is kept safe and used only for service improvement right to your doorstep.";
            }
            else if (type === "terms") {
                title.innerText = "Terms & Conditions";
                content.innerText = "These are demo Terms & Conditions. By using Brixo Mart services, you agree to follow our guidelines and policies for a better experience.";
            }
            else if (type === "refund") {
                title.innerText = "Refund Policy";
                content.innerText = "This is a demo Refund Policy. Refunds are processed within 5-7 business days subject to eligibility and product condition.";
            }

            modal.style.display = "flex";
        }
    }

    function closeModal() {
        const modal = document.getElementById("policyModal");
        if (modal) modal.style.display = "none";
    }

    // Initialize the app
    function initApp() {
        // Add event listeners for navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function() {
                const target = this.getAttribute('data-target');
                if (target === 'categories') {
                    showCategories();
                } else if (target === 'categories-grid') {
                    showCategoriesGrid();
                } else if (target === 'wishlist') {
                    showWishlist();
                } else if (target === 'cart') {
                    showCart();
                }
            });
        });

        // Add event listeners for category items
        document.querySelectorAll('.category').forEach(category => {
            category.addEventListener('click', function() {
                const categoryName = this.getAttribute('data-category');
                showProducts(categoryName);
            });
        });

        // Add event listeners for back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const target = this.getAttribute('data-target');
                if (target === 'categories') {
                    showCategories();
                } else if (target === 'categories-grid') {
                    showCategoriesGrid();
                } else if (target === 'products') {
                    showProducts(currentCategory);
                }
            });
        });

        // Initialize cart count
        updateCartCount();
    }

    // Run initialization when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

    // Show Orders Function
    function showOrders() {
  document.body.classList.add('products-page-open');
  document.getElementById('categories-page').classList.add('hidden');
  document.getElementById('categories-grid-page').classList.add('hidden');
  document.getElementById('products-page').classList.add('hidden');
  document.getElementById('product-detail-page').classList.add('hidden');
  document.getElementById('wishlist-page').classList.add('hidden');
  document.getElementById('cart-page').classList.add('hidden');
  document.getElementById('orders-page').classList.remove('hidden');
  document.getElementById('payment-page').classList.add('hidden');
  document.getElementById('profile-page').classList.add('hidden');
  document.getElementById('order-detail-page').classList.add('hidden');  // Ensure detail page is hidden initially

  document.getElementById('header-section').style.display = 'block'; // Ensure header is shown
  document.getElementById('app-footer').style.display = 'none'; // Hide footer

  // Close menu if open
  if (menu && overlay) {
      menu.classList.remove('active');
      overlay.classList.remove('active');
  }

  // Update orders count
  document.getElementById('orders-count').textContent = orders.length;

  // Display orders
  const ordersList = document.getElementById('orders-list');
  ordersList.innerHTML = '';

  if (orders.length === 0) {
      ordersList.innerHTML = `
          <div class="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#666">
                  <path d="M8 1h8v2H8zM6 5h12v2H6zM4 9h16v2H4zM2 13h20v2H2zM0 17h24v2H0z"/>
              </svg>
              <p>You have no orders yet</p>
              <button onclick="showCategories()" class="continue-shopping-btn">Continue Shopping</button>
          </div>
      `;
  } else {
      orders.forEach(order => {
          const orderDiv = document.createElement('div');
          orderDiv.className = 'order-item';
          orderDiv.onclick = () => showOrderDetail(order.id);  // Add click handler

          let itemsHtml = '';
          order.items.forEach(item => {
              itemsHtml += `
                  <div class="order-item-detail">
                      <span>${item.name} x ${item.quantity}</span>
                      <span>₹${parseInt(item.price.replace(/[^0-9]/g, '')) * item.quantity}</span>
                  </div>
              `;
          });

          orderDiv.innerHTML = `
              <div class="order-header">
                  <span>Order #${order.id}</span>
                  <span>${order.date}</span>
              </div>
              ${itemsHtml}
              <div class="order-total">
                  <span>Total</span>
                  <span>₹${order.total}</span>
              </div>
              <div class="order-status">${order.status}</div>
          `;

          ordersList.appendChild(orderDiv);
      });
  }
  updateCartCount(); // Update visibility

  // Push to history
  history.pushState({page: 'orders'}, '', '?page=orders');
}

// New Function: Show Order Detail
function showOrderDetail(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  // Hide other pages, show order detail
  document.getElementById('orders-page').classList.add('hidden');
  document.getElementById('order-detail-page').classList.remove('hidden');

  document.getElementById('header-section').style.display = 'block'; // Ensure header is shown
  document.getElementById('app-footer').style.display = 'none'; // Hide footer

  // Populate header times
  const placedDate = new Date(order.date);
  const deliveryDate = new Date(placedDate.getTime() + 13* 60000); // +13 min like in image
  document.getElementById('order-placed-time').textContent = placedDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true}).toUpperCase();
  document.getElementById('order-delivery-time').textContent = deliveryDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit',hour12: true}).toUpperCase();

  // Total amount
  document.getElementById('order-total-amount').textContent = order.total;

  // Item count and ID
  let totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('order-item-count').textContent = `${totalItems} Item${totalItems > 1 ? 's' : ''}`;
  document.getElementById('order-id').textContent = 'ORD' + Math.floor(Math.random() * 1000000000); // Random ID like in image

  // Items list
  const itemsList = document.getElementById('order-items-list');
  itemsList.innerHTML = '';
  order.items.forEach(item => {
    const price = parseInt(item.price.replace(/[^0-9]/g, '')) * item.quantity;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    itemDiv.innerHTML = `
      <img src="${item.image || 'https://via.placeholder.com/60x60?text=No+Image'}" alt="${item.name}" class="item-image">
      <div class="item-details">
        <div class="item-name">${item.name}</div>
        <div class="item-price">₹${price} x ${item.quantity}</div>
      </div>
    `;
    itemsList.appendChild(itemDiv);
  });

  // Payment summary (for cart breakdown)
  const itemsTotal = order.mrp - order.productDiscount;
  document.getElementById('order-items-total').textContent = `₹${itemsTotal}`;
  document.getElementById('order-discount').textContent = `-₹${order.productDiscount}`;
  document.getElementById('order-platform').textContent = `₹${order.platformFee}`;
  document.getElementById('order-delivery').textContent = order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`;
  document.getElementById('order-handling').textContent = `₹${order.handlingFee}`;

  // Add Grand Total to summary
  document.getElementById('order-grand-total').textContent = `₹${order.total}`;

  // Progress bar (for demo, only "Placed" active; extend based on order.status if needed)
  const steps = document.querySelectorAll('.progress-step');
  steps.forEach((step, idx) => step.classList.toggle('active', idx === 0));

  // Reorder button (for demo, redirects to cart; implement reorder logic if needed)
  document.querySelector('.reorder-btn').onclick = () => {
    cartItems = order.items.map(item => ({...item}));
    showCart();
  };

  // Push to history
  history.pushState({page: 'order-detail', id: id}, '', '?page=order-detail&id=' + id);
}

    // Function to show profile page
    function showProfile() {
        document.body.classList.add('products-page-open');
        document.getElementById('categories-page').classList.add('hidden');
        document.getElementById('categories-grid-page').classList.add('hidden');
        document.getElementById('products-page').classList.add('hidden');
        document.getElementById('product-detail-page').classList.add('hidden');
        document.getElementById('wishlist-page').classList.add('hidden');
        document.getElementById('cart-page').classList.add('hidden');
        document.getElementById('orders-page').classList.add('hidden');
        document.getElementById('payment-page').classList.add('hidden');
        document.getElementById('order-detail-page').classList.add('hidden');
        document.getElementById('profile-page').classList.remove('hidden');

        document.getElementById('header-section').style.display = 'block';

        document.getElementById('app-footer').style.display = 'none';

        updateProfileDisplay();
        updateCartCount(); // Update visibility

        // Push to history
        history.pushState({page: 'profile'}, '', '?page=profile');
    }

    // Address Book Function (Opens Location Popup)
    function showAddressBook() {
        locationPopup.style.display = "flex";
    }

    // Privacy Policy Function
    function showPrivacyPolicy() {
        openModal('privacy');
    }

// DOM Elements
const paymentOptions = document.querySelectorAll(".option");
const paymentLocationPopup = document.getElementById("paymentLocationPopup");
const paymentConfirmBtn = document.getElementById("paymentConfirmAddress");
const paymentToast = document.getElementById("paymentToast");
const paymentToastMessage = document.getElementById("paymentToastMessage");
const paymentSuccessPage = document.getElementById("paymentSuccessPage");
const paymentSuccessText = document.getElementById("paymentSuccessText");
const paymentSuccessSound = document.getElementById("paymentSuccessSound");
const paymentUseLocation = document.getElementById("paymentUseLocation");
const paymentPincodeInput = document.getElementById("paymentPincode");
const paymentSuggestionsBox = document.getElementById("paymentSuggestions");
const paymentPlaceOrderBtn = document.getElementById("paymentPlaceOrderBtn");
const paymentLocationLoading = document.getElementById("paymentLocationLoading");
const paymentLocationMessage = document.getElementById("paymentLocationMessage");
const paymentMapError = document.getElementById("paymentMapError");
const paymentClosePopup = document.getElementById("paymentClosePopup");
const paymentAddressSummary = document.getElementById("paymentAddressSummary");
const paymentAddressDetails = document.getElementById("paymentAddressDetails");
const paymentEditAddressBtn = document.getElementById("paymentEditAddress");

// State variables
let selectedOption = null, paymentMap, paymentMarker, paymentCoords = null, paymentDebounceTimer, paymentCache = {}, paymentSelectedIndex = -1, paymentCurrentSuggestions = [];
let paymentAddressFieldsFilled = false;
let confirmedAddress = null;

// Initialize the payment system
function paymentInit() {
  // Payment select
  paymentOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      paymentOptions.forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedOption = opt.querySelector(".option-title").textContent;
      paymentPlaceOrderBtn.disabled = false;
    });
  });

  // Close popup handler
  paymentClosePopup.addEventListener("click", () => {
    paymentLocationPopup.style.display = "none";
  });

  // Show address popup when place order is clicked
  paymentPlaceOrderBtn.addEventListener("click", () => {
    if (!selectedOption) {
      paymentShowToast("Please select a payment method first!");
      return;
    }
    
    // If address is already confirmed, proceed to place order
    if (confirmedAddress) {
      placeOrder();
      return;
    }
    
    // Otherwise, show address popup
    paymentLocationPopup.style.display = "flex";
  });

  // Edit address handler
  paymentEditAddressBtn.addEventListener("click", () => {
    paymentLocationPopup.style.display = "flex";
  });

  // Manual location detection
  paymentUseLocation.addEventListener("click", paymentDetectLocation);

  // Pincode autocomplete
  paymentPincodeInput.addEventListener("input", paymentHandlePincodeInput);

  // Keyboard navigation for suggestions
  paymentPincodeInput.addEventListener("keydown", paymentHandlePincodeKeydown);

  // Close suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (e.target !== paymentPincodeInput && e.target.parentNode !== paymentSuggestionsBox) {
      paymentSuggestionsBox.style.display = "none";
    }
  });

  // Check if all address fields are filled
  document.getElementById("paymentName").addEventListener("input", paymentCheckAddressFields);
  document.getElementById("paymentMobile").addEventListener("input", paymentCheckAddressFields);
  document.getElementById("paymentHouse").addEventListener("input", paymentCheckAddressFields);
  document.getElementById("paymentStreet").addEventListener("input", paymentCheckAddressFields);
  paymentPincodeInput.addEventListener("input", paymentCheckAddressFields);

  // Confirm Address
  paymentConfirmBtn.addEventListener("click",paymentConfirmAddress);
}

// Location detection function
function paymentDetectLocation() {
  if (!navigator.geolocation) {
    paymentShowToast("Geolocation not supported by your browser");
    return;
  }
  
  paymentLocationLoading.style.display = "block";
  paymentUseLocation.style.display = "none";
  paymentLocationMessage.style.display = "block";
 paymentMapError.style.display = "none";
  
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      paymentCoords = {lat: pos.coords.latitude, lng: pos.coords.longitude};
      try {
        await paymentShowMap(paymentCoords);
        await paymentFetchAddress(paymentCoords);
        paymentLocationLoading.style.display = "none";
        paymentUseLocation.style.display = "flex";
        paymentLocationMessage.style.display = "none";
      } catch (error) {
        console.error("Map error:", error);
        paymentLocationLoading.style.display = "none";
        paymentUseLocation.style.display = "flex";
        paymentLocationMessage.style.display = "none";
        paymentMapError.style.display = "block";
      }
    },
    (error) => {
      paymentLocationMessage.textContent = "Location permission denied or unable to get location";
      console.error("Geolocation error:", error);
      paymentLocationLoading.style.display = "none";
      paymentUseLocation.style.display = "flex";
    },
    {timeout: 10000, enableHighAccuracy: true}
  );
}

// Show map function
function paymentShowMap({lat, lng}) {
  return new Promise((resolve, reject) => {
    try {
      // Initialize map if not already done
      if (!paymentMap) {
        paymentMap = L.map("paymentMap").setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(paymentMap);

        // Create a custom icon for the marker
        const customIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
          shadowSize: [41, 41]
        });

        paymentMarker = L.marker([lat, lng], {icon: customIcon, draggable: true}).addTo(paymentMap);
        
        // Update address when marker is dragged
        paymentMarker.on("dragend", function() {
          const position = paymentMarker.getLatLng();
          paymentCoords = {lat: position.lat, lng: position.lng};
          paymentFetchAddress(paymentCoords);
        });
      } else {
        paymentMap.setView([lat, lng], 15);
        paymentMarker.setLatLng([lat, lng]);
      }
      
      // Make sure the map container is visible
      document.getElementById("paymentMap").style.display = "block";
      
      // Small delay to ensure map renders properly
      setTimeout(() => {
        paymentMap.invalidateSize();
        resolve();
      }, 100);
    } catch (error) {
      console.error("Error initializing map:", error);
      paymentMapError.style.display = "block";
      reject(error);
    }
  });
}

// Fetch address from coordinates
async function paymentFetchAddress({lat, lng}) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
    
    if (!res.ok) {
      console.error('Geocoding API error:', res.status);
      return;
    }
    
    const data = await res.json();
    
    if (data && data.address) {
      document.getElementById("paymentStreet").value = data.address.road || data.address.suburb || '';
      document.getElementById("paymentPincode").value = data.address.postcode || '';
      
      if (data.display_name) {
        const addressParts = data.display_name.split(',');
        if (addressParts.length > 0) {
          document.getElementById("paymentHouse").value = addressParts[0] || '';
        }
      }
    }
  } catch(err) { 
    console.error('Error with geocoding API:', err);
  }
  
  // Check if address fields are filled to enable confirm button
  paymentCheckAddressFields();
}

// Pincode input handler
function paymentHandlePincodeInput() {
  const query = paymentPincodeInput.value.trim();
  clearTimeout(paymentDebounceTimer);
  paymentSelectedIndex = -1;
  
  // Only allow numeric input
  paymentPincodeInput.value = paymentPincodeInput.value.replace(/\D/g, '');
  
  if (query.length !== 6) { 
    paymentSuggestionsBox.style.display = "none";
    paymentSuggestionsBox.innerHTML = ""; 
    return;
  }
  
  if (paymentCache[query]) { 
    paymentRenderSuggestions(paymentCache[query]); 
    return;
  }
  
  paymentDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${query}`);
      const data = await res.json();
      
      if (data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        paymentCache[query] = data[0].PostOffice;
        paymentRenderSuggestions(data[0].PostOffice);
      } else {
        paymentSuggestionsBox.innerHTML = "<div>No results found</div>";
        paymentSuggestionsBox.style.display = "block";
      }
    } catch(err) { 
      console.error("Pincode API error:", err);
      paymentSuggestionsBox.innerHTML = "<div>Error fetching data</div>";
      paymentSuggestionsBox.style.display = "block";
    }
  }, 300);
}

// Render pincode suggestions
function paymentRenderSuggestions(list) {
  paymentCurrentSuggestions = list;
  paymentSuggestionsBox.innerHTML = "";
  
  if (list.length === 0) {
    paymentSuggestionsBox.innerHTML = "<div>No results found</div>";
    paymentSuggestionsBox.style.display = "block";
    return;
  }
  
  list.forEach((item, i) => {
    const div = document.createElement("div");
    div.textContent = `${item.Name}, ${item.District}, ${item.State}`;
    div.onclick = () => paymentSelectSuggestion(i);
    paymentSuggestionsBox.appendChild(div);
  });
  
  paymentSuggestionsBox.style.display = "block";
}

// Select a suggestion
function paymentSelectSuggestion(index) {
  const place = paymentCurrentSuggestions[index];
  document.getElementById("paymentStreet").value = place.Name;
  document.getElementById("paymentPincode").value = place.Pincode;
  paymentSuggestionsBox.style.display = "none";
  paymentSuggestionsBox.innerHTML = "";
  
  // Check if address fields are filled to enable confirm button
  paymentCheckAddressFields();
}

// Keyboard navigation for suggestions
function paymentHandlePincodeKeydown(e) {
  const items = paymentSuggestionsBox.querySelectorAll("div");
  if (items.length === 0) return;
  
  if (e.key === "ArrowDown") {
    e.preventDefault();
    paymentSelectedIndex = (paymentSelectedIndex + 1) % items.length;
    paymentUpdateActive(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    paymentSelectedIndex = (paymentSelectedIndex - 1 + items.length) % items.length;
    paymentUpdateActive(items);
  } else if (e.key === "Enter" && paymentSelectedIndex >= 0) {
    e.preventDefault();
    paymentSelectSuggestion(paymentSelectedIndex);
  } else if (e.key === "Escape") {
    paymentSuggestionsBox.style.display = "none";
  }
}

// Update active suggestion
function paymentUpdateActive(items) { 
  items.forEach((item, i) => item.classList.toggle("active", i === paymentSelectedIndex));
  
  // Scroll into view
  if (paymentSelectedIndex >= 0) {
    items[paymentSelectedIndex].scrollIntoView({block: "nearest"});
  }
}

// Check if all address fields are filled
function paymentCheckAddressFields() {
  const name = document.getElementById("paymentName").value;
  const mobile = document.getElementById("paymentMobile").value;
  const house = document.getElementById("paymentHouse").value;
  street = document.getElementById("paymentStreet").value;
  const pin = document.getElementById("paymentPincode").value;

  paymentAddressFieldsFilled = name && mobile && house && street && pin;
  paymentConfirmBtn.disabled = !paymentAddressFieldsFilled;
}

// Toast function
function paymentShowToast(message) {
  paymentToastMessage.innerText = message;
 paymentToast.classList.add("show");
  setTimeout(() => paymentToast.classList.remove("show"), 2500);
}

// Confirm Address
function paymentConfirmAddress() {
  const name = document.getElementById("paymentName").value;
  const mobile = document.getElementById("paymentMobile").value;
  const house = document.getElementById("paymentHouse").value;
  const street = document.getElementById("paymentStreet").value;
  const pin = document.getElementById("paymentPincode").value;

  if (!name || !mobile || !house || !street || !pin) { 
    paymentShowToast("Please fill all address fields!"); 
    return;
  }

  // Validate mobile number
  if (!/^\d{10}$/.test(mobile)) {
    paymentShowToast("Please enter a valid 10-digit mobile number");
    return;
  }

  // Validate pincode
  if (!/^\d{6}$/.test(pin)) {
    paymentShowToast("Please enter a valid 6-digit pincode");
    return;
  }

  // Save address details
  confirmedAddress = { name, mobile, house, street, pin };
  
  // Update address summary
  paymentAddressDetails.innerHTML = `
    <strong>${name}</strong><br>
    ${house}, ${street}<br>
    Pincode: ${pin}<br>
    Mobile: ${mobile}
  `;
  
  // Show address summary
  paymentAddressSummary.style.display = "block";
  
  paymentLocationPopup.style.display = "none";
  paymentShowToast("Address Saved!");
  
  // Now the user can place the order
  paymentPlaceOrderBtn.disabled = false;
}

// Place Order
function placeOrder() {
  if (!isLoggedIn) {
    pendingPlaceOrder = true;
    showLogin();
    return;
  }

  if (paymentPlaceOrderBtn.disabled) return;  // Prevent multiple clicks
  paymentPlaceOrderBtn.disabled = true;

  if (!confirmedAddress) {
    paymentShowToast("Please confirm your address first!");
    return;
  }
  
  if (!selectedOption) {
    paymentShowToast("Please select a payment method first!");
    return;
  }

  // Calculate MRP, discount, fees for order summary (same as cart)
  let mrp = 0;
  let productDiscount = 0;

  cartItems.forEach(item => {
      const price = parseInt(item.price.replace(/[^0-9]/g, ''));
      const orig = item.originalPrice ? parseInt(item.originalPrice.replace(/[^0-9]/g, '')) : price;
      mrp += orig * item.quantity;
      productDiscount += (orig - price) * item.quantity;
  });

  const itemsTotal = mrp - productDiscount;
  const platformFee = 5;
  const deliveryFee = (itemsTotal >= 299) ? 0 : 30;
  const handlingFee = 10;

  // Add the order
  orders.push({
      id: Date.now(),
      date: new Date().toLocaleString(),
      items: cartItems.map(item => ({...item})),
      total: totalAmount,
      status: 'Processing',
      mrp,
      productDiscount,
      platformFee,
      deliveryFee,
      handlingFee
  });

  // Clear cart
  cartItems = [];
  // Reset product UI (change all qty-controls back to ADD buttons site-wide)
  document.querySelectorAll('.qty-control').forEach(ctrl => {
    ctrl.outerHTML = '<div class="add-btn" onclick="addToCart(event, this)">ADD</div>';
  });
  updateCartCount();

  // Show success page after order is placed
  paymentSuccessText.innerText = `Order Placed Successfully with ${selectedOption}`;
  paymentSuccessPage.style.display = "flex";
  if (paymentSuccessSound) paymentSuccessSound.play();
  setTimeout(() => {
    paymentSuccessPage.style.display = "none";
    // Reset the form after successful order
    paymentResetForm();
    showCategories();
    paymentPlaceOrderBtn.disabled = false;  // Re-enable after reset
  }, 3000);
}

// Reset form after successful order
function paymentResetForm() {
  paymentAddressSummary.style.display = "none";
  paymentOptions.forEach(o => o.classList.remove("selected"));
  selectedOption = null;
  paymentPlaceOrderBtn.disabled = true;
  
  // Clear form fields
  document.getElementById("paymentName").value = "";
  document.getElementById("paymentMobile").value = "";
  document.getElementById("paymentHouse").value = "";
  document.getElementById("paymentStreet").value = "";
  document.getElementById("paymentPincode").value = "";
  
  confirmedAddress = null;
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', paymentInit);

// New Function: Contact Support
function contactSupport() {
  window.location.href = 'tel:8407031843';
}
// ... (Your existing code up to the search variables remains the same)

// Add these new variables for autocomplete
let searchSuggestionsBox;  // We'll create this dynamically
let searchCurrentSuggestions = [];
let searchSelectedIndex = -1;
let searchDebounceTimer;

// In your DOMContentLoaded or initApp():
// Create suggestions box dynamically (below search input)
searchSuggestionsBox = document.createElement('div');
searchSuggestionsBox.className = 'suggestions';
searchSuggestionsBox.id = 'search-suggestions';
searchSuggestionsBox.style.display = 'none';
searchSuggestionsBox.style.position = 'absolute';
searchSuggestionsBox.style.zIndex = '1000';
searchSuggestionsBox.style.background = '#fff';
searchSuggestionsBox.style.border = '1px solid #ccc';
searchSuggestionsBox.style.borderRadius = '8px';
searchSuggestionsBox.style.maxHeight = '200px';
searchSuggestionsBox.style.overflowY = 'auto';
searchSuggestionsBox.style.width = '100%';  // Match input width
searchSuggestionsBox.style.top = '100%';  // Position below input
searchSuggestionsBox.style.left = '0';    // Align left

// Append to overlay (for overlay search)
document.querySelector('.search-bar').appendChild(searchSuggestionsBox.cloneNode(true));  // Clone for overlay

// For home search: Append a separate suggestions box below home search
const homeSearchContainer = document.querySelector('.home-search');
const homeSuggestionsBox = searchSuggestionsBox.cloneNode(true);
homeSearchContainer.appendChild(homeSuggestionsBox);

// Now, attach input event to BOTH search inputs
homeSearchInput.addEventListener('input', (e) => handlePredictiveSearch(e, homeSuggestionsBox, true));  // true = isHomeSearch
searchInput.addEventListener('input', (e) => handlePredictiveSearch(e, document.querySelector('#searchOverlay .suggestions'), false));

// Keyboard navigation for BOTH
homeSearchInput.addEventListener('keydown', (e) => handleSearchKeydown(e, homeSuggestionsBox));
searchInput.addEventListener('keydown', (e) => handleSearchKeydown(e, document.querySelector('#searchOverlay .suggestions')));

// Close suggestions on click outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.home-search') && !e.target.closest('.search-bar')) {
    homeSuggestionsBox.style.display = 'none';
    document.querySelector('#searchOverlay .suggestions').style.display = 'none';
  }
});

// New Function: Handle Predictive Search
function handlePredictiveSearch(e, suggestionsBox, isHomeSearch = false) {
  const query = e.target.value.trim().toLowerCase();
  const resultsContainer = isHomeSearch ? null : document.getElementById('search-results');  // Only overlay has results grid
  
  suggestionsBox.innerHTML = '';
  suggestionsBox.style.display = 'none';
  clearTimeout(searchDebounceTimer);

  if (resultsContainer) resultsContainer.innerHTML = '';

  if (query.length < 2) {
    if (isHomeSearch) {
      // For home, do nothing or show placeholder
    } else {
      resultsContainer.innerHTML = '<div class="empty-state">Start typing to search products...</div>';
    }
    return;
  }

  // Open overlay if typing in home search
  if (isHomeSearch) {
    searchOverlay.classList.add('active');
    searchInput.value = query;  // Sync value to overlay
    searchInput.focus();
  }

  // Debounce search
  searchDebounceTimer = setTimeout(() => {
    // Collect all products
    let allProducts = [];
    for (const cat in productsData) {
      productsData[cat].forEach((prod, idx) => {
        allProducts.push({category: cat, product: prod, index: idx});
      });
    }

    // Filter matches (predictive: starts with or includes query)
    const matches = allProducts.filter(item => 
      item.product.name.toLowerCase().startsWith(query) || item.product.name.toLowerCase().includes(query)
    ).slice(0, 10);  // Limit to 10 suggestions

    if (matches.length === 0) {
      suggestionsBox.innerHTML = '<div>No results found</div>';
      suggestionsBox.style.display = 'block';
      if (resultsContainer) resultsContainer.innerHTML = '<div class="empty-state">No products found for "' + query + '"</div>';
      return;
    }

    // Render suggestions dropdown
    searchCurrentSuggestions = matches;
    matches.forEach((match, i) => {
      const div = document.createElement('div');
      div.innerHTML = `
        <strong>${match.product.name}</strong><br>
        <small>${match.category} - ${match.product.price}</small>
      `;
      div.onclick = () => {
        selectSearchSuggestion(i);
        suggestionsBox.style.display = 'none';
      };
      suggestionsBox.appendChild(div);
    });
    suggestionsBox.style.display = 'block';

    // Also show full results in grid (for overlay only)
    if (resultsContainer) {
      matches.forEach(match => {
        const card = createProductCard(match.category, match.index, match.product);
        resultsContainer.appendChild(card);
      });
    }
  }, 300);  // 300ms debounce
}

// New Function: Select Suggestion
function selectSearchSuggestion(index) {
  const match = searchCurrentSuggestions[index];
  showProductDetail(match.category, match.index);
  searchInput.value = '';  // Clear search
  homeSearchInput.value = '';  // Clear home if open
}

// New Function: Keyboard Navigation
function handleSearchKeydown(e, suggestionsBox) {
  const items = suggestionsBox.querySelectorAll('div');
  if (items.length === 0) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchSelectedIndex = (searchSelectedIndex + 1) % items.length;
    updateSearchActive(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchSelectedIndex = (searchSelectedIndex - 1 + items.length) % items.length;
    updateSearchActive(items);
  } else if (e.key === 'Enter' && searchSelectedIndex >= 0) {
    e.preventDefault();
    selectSearchSuggestion(searchSelectedIndex);
  } else if (e.key === 'Escape') {
    suggestionsBox.style.display = 'none';
  }
}

// Helper: Update active suggestion
function updateSearchActive(items) {
  items.forEach((item, i) => item.classList.toggle('active', i === searchSelectedIndex));
  if (searchSelectedIndex >= 0) {
    items[searchSelectedIndex].scrollIntoView({block: 'nearest'});
  }
}

// For product recommendations: Enhance related products to include from other categories
// In showProductDetail, after related from same category, add recommended section

// Add this inside showProductDetail after relatedProductsGrid population:

// Recommended Products (random from other categories)
const recommendedSection = document.createElement('div');
recommendedSection.className = 'related-products';
recommendedSection.innerHTML = '<h2>Recommended for You</h2>';
const recommendedGrid = document.createElement('div');
recommendedGrid.className = 'related-products-grid';
recommendedSection.appendChild(recommendedGrid);

// Get all products
let allProducts = [];
for (const cat in productsData) {
  if (cat !== currentCategory) {  // Exclude current category
    productsData[cat].forEach((prod, idx) => {
      allProducts.push({category: cat, product: prod, index: idx});
    });
  }
}

// Shuffle and pick 4 random
allProducts = allProducts.sort(() => 0.5 - Math.random()).slice(0, 4);

allProducts.forEach(match => {
  const card = createProductCard(match.category, match.index, match.product);
  recommendedGrid.appendChild(card);
});

// Append after related
document.querySelector('.related-products').after(recommendedSection);

// ... (rest of your JS code)


// Helper to create product card (similar to showProducts)
function createProductCard(category, index, product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.onclick = () => showProductDetail(category, index);

  const isInWishlist = wishlistItems.some(item => item.name === product.name);
  const cartItem = cartItems.find(item => item.name === product.name);
  const quantity = cartItem ? cartItem.quantity : 0;

  card.innerHTML = `
    <button class="wishlist ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(event, this, '${category}', ${index})">
      <svg viewBox="0 0 24 24">
        <path d="M12.001 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12.001 21.35z"/>
      </svg>
    </button>
    <div class="product-image-container">
      <img src="${product.image}" class="product-image" alt="${product.name}">
    </div>
    <div class="product-info">
      <div class="product-title">${product.name}</div>
      <div class="product-price">${product.price}</div>
      <div class="bottom-row">
        <span class="discount-text">${product.discount}</span>
        ${quantity > 0 ? 
          `<div class="qty-control">
             <button onclick="decreaseQty(event, this, '${product.name}')">-</button>
             <span>${quantity}</span>
             <button onclick="increaseQty(event, this, '${product.name}')">+</button>
           </div>` : 
          `<div class="add-btn" onclick="addToCart(event, this, '${product.name}')">ADD</div>`}
      </div>
    </div>
  `;

  return card;
}

// New Function: Populate Featured Sections Dynamically
function populateFeaturedSections() {
  // Fresh Section
  const freshGrid = document.getElementById('fresh-grid');
  const freshFeatured = [
    {category: 'Apples', index: 0},
    {category: 'Bananas', index: 0},
    {category: 'Oranges', index: 0},
    {category: 'Grapes', index: 0}
  ];
  freshFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    freshGrid.appendChild(card);
  });

  // Categories (Groceries) Section
  const categoriesProductGrid = document.getElementById('categories-product-grid');
  const groceriesFeatured = [
    {category: 'Rice', index: 0},
    {category: 'Oil', index: 0},
    {category: 'Wheat', index: 0},
    {category: 'Salt', index: 0}
  ];
  groceriesFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    categoriesProductGrid.appendChild(card);
  });

  // Beauty Section
  const beautyGrid = document.getElementById('beauty-grid');
  const beautyFeatured = [
    {category: 'Shampoo', index: 0},
    {category: 'Soap', index: 0},
    {category: 'Toothpaste', index: 0},
    {category: 'Face Wash', index: 0}
  ];
  beautyFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    beautyGrid.appendChild(card);
  });

  // Kids Section
  const kidsGrid = document.getElementById('kids-grid');
  const kidsFeatured = [
    {category: 'Kids', index: 0},
    {category: 'Kids', index: 1},
    {category: 'Kids', index: 2},
    {category: 'Kids', index: 3}
  ];
  kidsFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    kidsGrid.appendChild(card);
  });

  // Toys Section
  const toysGrid = document.getElementById('toys-grid');
  const toysFeatured = [
    {category: 'Toys', index: 0},
    {category: 'Toys', index: 1},
    {category: 'Toys', index: 2},
    {category: 'Toys', index: 3}
  ];
  toysFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    toysGrid.appendChild(card);
  });

  // Electronic Section
  const electronicGrid = document.getElementById('electronic-grid');
  const electronicFeatured = [
    {category: 'Electronic', index: 0},
    {category: 'Electronic', index: 1},
    {category: 'Electronic', index: 2},
    {category: 'Electronic', index: 3}
  ];
  electronicFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    electronicGrid.appendChild(card);
  });

  // Top Deals Section
  const topDealsGrid = document.getElementById('top-deals-grid');
  const topDealsFeatured = [
    {category: 'Top Deals', index: 0},
    {category: 'Top Deals', index: 1},
    {category: 'Top Deals', index: 2},
    {category: 'Top Deals', index: 3}
  ];
  topDealsFeatured.forEach(({category, index}) => {
    const product = productsData[category][index];
    const card = createProductCard(category, index, product);
    topDealsGrid.appendChild(card);
  });
}
