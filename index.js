require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5001;
import cors from "cors";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://client-3t7k.vercel.app"
    ],
    credentials: true,
  })
);


// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = "mongodb+srv://db-user-1:qRSgMsoUQ6L0k3CG@cluster0.ljx7nxk.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    const db = client.db('mydb');
    const vehiclesCollection = db.collection('users');   // vehicles
    const bookingsCollection = db.collection('bookings');

    // ROOT
    app.get('/', (req, res) => {
      res.send('TravelEase Server is Running 🚗');
    });

    // ==================== VEHICLES ====================

    app.get('/vehicles', async (req, res) => {
      try {
        const { search, category, location, sort } = req.query;
        let query = {};

        if (search) {
          query.$or = [
            { vehicleName: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ];
        }
        if (category && category !== 'all') {
          query.category = category;
        }
        if (location) {
          query.location = { $regex: location, $options: 'i' };
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc') sortOption = { pricePerDay: 1 };
        if (sort === 'price_desc') sortOption = { pricePerDay: -1 };

        const vehicles = await vehiclesCollection.find(query).sort(sortOption).toArray();
        res.send(vehicles);
      } catch {
        res.status(500).send({ error: 'Failed to fetch vehicles' });
      }
    });

    app.get('/latest-vehicles', async (req, res) => {
      try {
        const vehicles = await vehiclesCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.send(vehicles);
      } catch {
        res.status(500).send({ error: 'Failed to fetch latest vehicles' });
      }
    });

    app.get('/vehicle/:id', async (req, res) => {
      try {
        const vehicle = await vehiclesCollection.findOne({
          _id: new ObjectId(req.params.id)
        });
        if (!vehicle) return res.status(404).send({ error: 'Vehicle not found' });
        res.send(vehicle);
      } catch {
        res.status(500).send({ error: 'Invalid ID' });
      }
    });

    app.get('/my-vehicles/:email', async (req, res) => {
      const vehicles = await vehiclesCollection
        .find({ userEmail: req.params.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(vehicles);
    });

    app.post('/vehicles', async (req, res) => {
      const newVehicle = {
        ...req.body,
        pricePerDay: parseFloat(req.body.pricePerDay),
        createdAt: new Date(),
      };
      const result = await vehiclesCollection.insertOne(newVehicle);
      res.send(result);
    });

    app.put('/vehicle/:id', async (req, res) => {
      const result = await vehiclesCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete('/vehicle/:id', async (req, res) => {
      const id = req.params.id;
      await vehiclesCollection.deleteOne({ _id: new ObjectId(id) });
      await bookingsCollection.deleteMany({ vehicleId: id });
      res.send({ message: 'Vehicle and related bookings deleted' });
    });

    // ==================== BOOKINGS ====================

    // ✅ Create Booking (Duplicate Prevented, No availability update)
    app.post('/bookings', async (req, res) => {
      try {
        const { vehicleId, userEmail } = req.body;

        const alreadyBooked = await bookingsCollection.findOne({
          vehicleId,
          userEmail,
        });

        if (alreadyBooked) {
          return res.status(400).send({ message: 'Already booked' });
        }

        const bookingData = {
          vehicleId,
          userEmail,
          bookedAt: new Date(),
          status: 'Booked',
        };

        const result = await bookingsCollection.insertOne(bookingData);
        res.send(result);
      } catch {
        res.status(400).send({ error: 'Failed to create booking' });
      }
    });

    // ✅ Get My Bookings
    app.get('/bookings/:email', async (req, res) => {
      const bookings = await bookingsCollection
        .find({ userEmail: req.params.email })
        .sort({ bookedAt: -1 })
        .toArray();

      const bookingsWithVehicle = await Promise.all(
        bookings.map(async (booking) => {
          const vehicle = await vehiclesCollection.findOne({
            _id: new ObjectId(booking.vehicleId)
          });
          return { ...booking, vehicle };
        })
      );

      res.send(bookingsWithVehicle);
    });

    // ✅ Remove Booking (Make available again)
    app.delete('/bookings/:id', async (req, res) => {
      const result = await bookingsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      if (result.deletedCount === 0) {
        return res.status(404).send({ error: 'Booking not found' });
      }

      res.send({ message: 'Booking removed successfully' });
    });

    console.log("TravelEase Server Ready 🚀");

  } catch (err) {
    console.error(err);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
