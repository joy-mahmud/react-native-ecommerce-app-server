const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
require('dotenv').config()
const app = express()
const port = 8000
const cors = require('cors')
app.use(cors());
const stripe = require('stripe')('sk_test_51OGypQAhHVSLKzJ68RQgOgbrYtiUZkWceeNgjbs3Ht2RCFPgUHzGvrfRmoXJ1uinJwtRhUnVkP8BpUMaGil2ww6Q00nnw0hHsZ')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const jwt = require('jsonwebtoken')
const uri=`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.7xouwts.mongodb.net/react-native-ecommerce`
mongoose.connect(uri, {
    useNewUrlParser: true, //not required for updated version of mongoose of v6.0.0
    useUnifiedTopology: true //not required for updated version of mongoose of v6.0.0

})
    .then(() => { console.log('connected to mongodb') })
    .catch((error => console.log('Error connecting to mongodb', error)))

app.listen(port, () => {
    console.log('server is running on port ', port)
})

const User = require('./models/user')
const Order = require('./models/order')
const Product = require('./models/product')
const { default: Stripe } = require('stripe')

const sendVerificationEmail = async (email, verificationToken) => {
    //create a nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "joymahmud1265@gmail.com",
            pass: 'mumc sqth gmol xgwz'
        }
    })
    //compose the mail
    const mailOptions = {
        from: "E-com",
        to: email,
        subject: "Email verification",
        text: `Please click the following link to verify your email:http://192.168.2.143:8000/verify/${verificationToken}`
    }
    try {
        await transporter.sendMail(mailOptions)
    } catch (error) {
        console.log("Error sending the mail", error)
    }
}

const generateSecretKey = () => {
    const secretKey = crypto.randomBytes(32).toString('hex')
    return secretKey
}

const secretKey = generateSecretKey()

//api endpoints
app.get('/',async(req,res)=>{
    res.send('easyshop-bd-server is runninng')
})
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body
        console.log(name, email, password)
        //check the user is already registered
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' })
        }
        //create a new user
        const newUser = new User({ name, email, password })
        //generate  a verification token
        newUser.verificationToken = crypto.randomBytes(20).toString('hex')
        //save the user to database
        await newUser.save()
        //send verification mail to the user
        sendVerificationEmail(newUser.email, newUser.verificationToken);
        res.status(200).json({ message: "Registration successfull" })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Registration failed' })
    }
})

//verify token
app.get('/verify/:token', async (req, res) => {
    try {
        const token = req.params.token
        const user = await User.findOne({ verificationToken: token })
        if (!user) {
            return res.status(404).json({ message: "Invalid verification token" })
        }

        user.verified = true
        user.verificationToken = undefined
        await user.save()
        res.status(200).json({ message: "Email verified successfully" })
    } catch (error) {
        res.status(500).json({ message: "Email verification failed" })
    }
})
//login api
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" })

        }
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid password" })
        }
        //generate token
        const token = jwt.sign({ userId: user._id }, secretKey)
        res.status(200).json({ token })
    } catch (error) {
        res.status(500).json({ message: "Login failed" })
    }
})
//fetch all products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();  
        res.status(200).send(products);       
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send({ message: 'Error fetching products' });
    }
});
//admin login
app.post('/adminLogin', async (req, res) => {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (user.role == 'admin') {
        if (user.password == password) {
            res.status(200).res.send({ user: 'admin', verified: true })
        } else {
            res.status(400).send({ user: 'admin', verified: false })
        }

    } else {
        res.status(400).send({ user: 'notAdmin' })
    }
})

app.post('/addresses', async (req, res) => {
    try {
        const { userId, address } = req.body
        // console.log(userId,address)
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ mesage: "user not found" })
        }
        user.addresses.push(address)
        await user.save()
        res.status(200).json({ message: 'address created successfully' })
    } catch (error) {
        res.status(500).json({ message: "Error adding address" })
    }
})

app.get('/addresses/:userId', async (req, res) => {
    try {
        const userId = req.params.userId
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }
        const addresses = user.addresses
        res.status(200).json({ addresses })
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving the address of this user' })
    }
})

//order endpoints
app.post('/orders', async (req, res) => {
    try {
        const { userId, cartItem, totalPrice, shippingAddress, paymentMethod, paymentStatus } = req.body
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }
        const products = cartItem.map((item) => ({
            name: item?.title,
            quantity: item?.quantity,
            price: item?.price,
            image: item?.image
        }))
        const order = new Order({
            user: userId,
            products: products,
            totalPrice: totalPrice,
            shippingAddress: shippingAddress,
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus
        })
        await order.save()
        res.status(200).json({ message: 'Order created successfully' })
    } catch (error) {
        console.log('errorr creating orders ', error)
        res.status(500).json({ message: 'Error creating orders' })
    }
})
//get all orders for the admin panel
app.get('/allOrders', async (req, res) => {
    try {

        const orders = await Order.find().populate('user');
        const ordersRev = orders.reverse()
        //console.log(orders);
        res.status(200).send(ordersRev)
    } catch (error) {
        console.error('Error fetching orders:', error); // Handle the error
        res.status(500).send({ message: 'Error fetching orders' });
    }
})
app.patch('/udateDeliveryStatus', async (req, res) => {
    const { status, id } = req.body
    //console.log(status,id)
    const query = { _id: new mongoose.Types.ObjectId(id) }
    const updateInfo = { deliveryStatus: status }
    const result = await Order.updateOne(query, {
        $set: updateInfo
    })
    console.log(result)
    if (result.modifiedCount === 0) {
        return res.status(404).send({ message: 'something goes wrong' });
    }

    res.status(200).send(result);
})

//allUsers api
app.get('/allUsers', async (req, res) => {
    try {

        const users = await User.find()
        const usersRev = users.reverse()
        //console.log(orders);
        res.status(200).send(usersRev)
    } catch (error) {
        console.error('Error fetching users:', error); // Handle the error
        res.status(500).send({ message: 'Error fetching users' });
    }
})
// delete a user
app.delete('/deleteUser', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).send({ message: 'Email is required' });
    }
    try {

        const result = await User.deleteOne({ email: email });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: 'User not found' });
        }

        res.status(200).send({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error', error: error.message });
    }
})

//user profile get api
app.get('/profile/:userId', async (req, res) => {
    try {
        const userId = req.params.userId
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: 'user not found' })
        }
        res.status(200).json({ user })
    } catch (error) {
        console.log('error fetching user', error)
        res.status(500).json({ message: 'Error fetching user' })
    }
})

//order get api
app.get('/orders/:userId', async (req, res) => {
    try {
        const userId = req.params.userId
        const orders = await Order.find({ user: userId }).populate("user")
        if (!orders || orders.length == 0) {
            return res.status(404).json({ message: 'no orders found' })
        }
        res.status(200).json({ orders })
    } catch (error) {
        console.log('error fetching orders', error)
        res.status(500).json({ message: 'error fetching orders' })
    }
})


//payment api
app.post('/paymentIntent', async (req, res) => {
    try {
        const price = req.body.amount;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            }

        });

        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.log(error);
    }
});
