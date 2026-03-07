import { VisualProctor } from './visual-proctoring2.js';
import { BehavioralProctor } from './behavioral-proctoring.js';

export class ProctoringManager {
    constructor(callbacks,isHighSecurity = true) {
        this.callbacks = callbacks;
        this.isHighSecurity = isHighSecurity; // --- STORE FLAG ---
        this.visualProctor = null;
        this.behavioralProctor = null;
    }

    async start(videoElement) {
        try {
            // Behavioral proctoring does not need the camera, so it can start first.
            this.behavioralProctor = new BehavioralProctor(this.callbacks);
            await this.behavioralProctor.start();

            // --- MODIFIED: Conditional visual proctoring ---
            if (this.isHighSecurity) {
                // Visual proctoring, which needs the camera, is started last.
                // By this point, face verification will have released the camera.
                this.visualProctor = await VisualProctor.create(this.callbacks);
                await this.visualProctor.start(videoElement);
            }
            // --- END MODIFICATION ---
            // Activate strict focus listeners only after everything is running.
            this.behavioralProctor.activateFocusListeners();

        } catch (error) {
            this.stop();
            throw error;
        }
    }

    stop() {
        this.visualProctor?.stop();
        this.behavioralProctor?.stop();
    }
}
