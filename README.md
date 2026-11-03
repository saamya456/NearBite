# NearBite 📍
### Discover Places Around You

NearBite is a location-based place discovery web application that allows users to explore places through an interactive map and an organized listing interface. It brings location information together with place details, ratings, and distance information to make discovering nearby places easier.

## ✨ Features

- **Place Discovery:** Browse a collection of available places.
- **Interactive Map:** Explore places through an interactive map interface.
- **Location Markers:** View individual places using map markers.
- **Place Ratings:** View ratings associated with listed places.
- **Distance Information:** Check the distance displayed for each place.
- **Pagination:** Navigate through large datasets efficiently.
- **Map Integration:** Visualize geographical locations using Leaflet and OpenStreetMap.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Server-side JavaScript runtime |
| MongoDB | Database |
| Leaflet.js | Interactive map visualization |
| OpenStreetMap | Map tile data |
| HTML, CSS, JavaScript | Web interface |

## 📁 Project Structure

```text
NearBite/
│
├── public/              # Frontend assets and static files
├── server.js            # Application server
├── seed.js              # Database seeding script
├── benchmark.js         # Benchmarking script
├── package.json         # Project dependencies and scripts
├── package-lock.json    # Dependency lock file
├── .env                 # Environment configuration
├── .gitignore           # Git ignored files
└── README.md            # Project documentation
```

## ⚙️ Getting Started

Follow these steps to run NearBite locally.

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd nearbite
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add:

```env
MONGO_URI=mongodb://127.0.0.1:27017/nearbite
PORT=3000
JWT_SECRET=your_secure_secret
```

Replace the example secret with your own secure value.

### 4. Start MongoDB

Ensure your MongoDB server is running locally.

### 5. Populate the Database

If you need to initialize the sample dataset, run:

```bash
node seed.js
```

### 6. Run the Application

```bash
node server.js
```

Open your browser and visit:

```text
http://localhost:3000
```

## 🗺️ Map Integration

NearBite uses Leaflet.js to display an interactive map and OpenStreetMap as its map tile source. Place markers help users visualize the geographical distribution of available locations.

Map tiles are provided by OpenStreetMap and are subject to its [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).

## 🚀 Future Enhancements

- Search places by name and category.
- Add category-based filtering.
- Improve location-based recommendations.
- Include detailed information for individual places.
- Enhance map performance and user experience.

## 👩‍💻 Project

**NearBite – Discover places around you.**

Developed as a database and web application project.