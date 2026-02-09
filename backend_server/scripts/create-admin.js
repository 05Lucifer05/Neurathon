/**
 * Create Admin User Script
 * Run: node scripts/create-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB connection string - update this or use .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fraud_detection';

// Admin credentials
const ADMIN_USER = {
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    organization: 'FraudShield',
    isActive: true,
    permissions: {
        canRunAnalysis: true,
        canViewAllAccounts: true,
        canManageUsers: true,
        canViewReports: true,
        canAccessSettings: true
    }
};

// User Schema (matching the model)
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    organization: { type: String, default: 'Default Organization' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    permissions: {
        canRunAnalysis: { type: Boolean, default: true },
        canViewAllAccounts: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canViewReports: { type: Boolean, default: true },
        canAccessSettings: { type: Boolean, default: false }
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);

        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: ADMIN_USER.email });
        if (existingAdmin) {
            console.log('⚠️  Admin user already exists!');
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   Role: ${existingAdmin.role}`);
            await mongoose.disconnect();
            process.exit(0);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(ADMIN_USER.password, salt);

        // Create admin user
        const admin = new User({
            ...ADMIN_USER,
            password: hashedPassword
        });

        await admin.save();

        console.log('');
        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('📧 Email:    admin@example.com');
        console.log('🔑 Password: admin123');
        console.log('👤 Role:     admin');
        console.log('🏢 Org:      FraudShield');
        console.log('');

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

createAdmin();
