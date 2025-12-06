import { Kafka } from "kafkajs"
import nodemailer from 'nodemailer';
import dotenv from "dotenv";

dotenv.config();

// Create transporter once and reuse it
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

let consumerInstance: any = null;

export const startSendMailConsumer = async () => {
    try {
        const kafka = new Kafka({
            clientId: "mail-service",
            brokers: [process.env.kafka_Broker || "localhost:9092"],
            retry: {
                initialRetryTime: 100,
                retries: 8,
            },
        });

        const consumer = kafka.consumer({ 
            groupId: "mail-service-group",
            sessionTimeout: 60000, // 60 seconds (increased from default 30s)
            heartbeatInterval: 3000, // 3 seconds (should be < sessionTimeout/3)
            maxInFlightRequests: 1, // Process one message at a time
            allowAutoTopicCreation: false,
        });

        consumerInstance = consumer;

        await consumer.connect();
        console.log("✅ Kafka consumer connected");

        const topicName = "send-mail";

        await consumer.subscribe({ 
            topic: topicName, 
            fromBeginning: false 
        });

        console.log("✅ Mail service consumer started, listening for sending mail");

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const messageValue = message.value?.toString();
                    if (!messageValue) {
                        console.log("⚠️  Received empty message, skipping");
                        return;
                    }

                    const { to, subject, html } = JSON.parse(messageValue);

                    if (!to || !subject || !html) {
                        console.log("⚠️  Invalid message format, missing required fields");
                        return;
                    }

                    await transporter.sendMail({
                        from: "Hireheaven <no-reply>",
                        to,
                        subject,
                        html,
                    });

                    console.log(`✅ Mail has been sent to ${to}`);
                }
                catch (error: any) {
                    console.error("❌ Failed to send mail:", error?.message || error);
                    // Don't throw error to avoid causing rebalancing
                }
            }
        });
    }
    catch (error: any) {
        console.error("❌ Failed to start kafka consumer:", error?.message || error);
    }
}

// Graceful shutdown handler
const gracefulShutdown = async () => {
    if (consumerInstance) {
        try {
            console.log("🛑 Shutting down Kafka consumer gracefully...");
            await consumerInstance.disconnect();
            console.log("✅ Kafka consumer disconnected");
        } catch (error: any) {
            console.error("❌ Error disconnecting consumer:", error?.message || error);
        }
    }
    process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
