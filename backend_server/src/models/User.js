/**
 * User Model - Authentication and user management
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    organization: {
        type: String,
        trim: true,
        default: 'Default Organization'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    permissions: {
        canRunAnalysis: { type: Boolean, default: true },
        canViewAllAccounts: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canViewReports: { type: Boolean, default: true },
        canAccessSettings: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

// Set permissions based on role
userSchema.pre('save', function (next) {
    if (this.isModified('role')) {
        if (this.role === 'admin') {
            this.permissions = {
                canRunAnalysis: true,
                canViewAllAccounts: true,
                canManageUsers: true,
                canViewReports: true,
                canAccessSettings: true
            };
        } else {
            this.permissions = {
                canRunAnalysis: true,
                canViewAllAccounts: false,
                canManageUsers: false,
                canViewReports: true,
                canAccessSettings: false
            };
        }
    }
    next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
