import { Request, Response } from 'express';
import UserService from '../services/user.service';

class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    public async register(req: Request, res: Response): Promise<Response> {
        try {
            const user = await this.userService.register(req.body);
            return res.status(201).json(user);
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }
    }

    public async login(req: Request, res: Response): Promise<Response> {
        try {
            const token = await this.userService.login(req.body);
            return res.status(200).json({ token });
        } catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }

    public async getUser(req: Request, res: Response): Promise<Response> {
        try {
            const user = await this.userService.getUser(req.params.id);
            return res.status(200).json(user);
        } catch (error) {
            return res.status(404).json({ message: error.message });
        }
    }
}

export default UserController;