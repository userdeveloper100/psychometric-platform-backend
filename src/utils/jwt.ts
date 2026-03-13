import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Replace with your actual secret

export const generateToken = (userId: string) => {
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
    return token;
};

export const verifyToken = (token: string) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
};