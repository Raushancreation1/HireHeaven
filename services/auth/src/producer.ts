import { Kafka, Producer, Admin } from "kafkajs"
import dotenv from 'dotenv'

dotenv.config();

// Silence KafkaJS partitioner warning
process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";

let producer: Producer;
let admin: Admin;

export const connectKafka = async () => {
    try {
        const kafka = new Kafka({
            clientId: "auth-service",
            brokers: [process.env.kafka_Broker || "localhost:9092"],
            connectionTimeout: 10000, // 10 seconds
            requestTimeout: 10000,
            retry: {
                retries: 3,
                initialRetryTime: 100,
                multiplier: 2,
            },
        });

        admin = kafka.admin();
        
        // Connect with timeout
        await Promise.race([
            admin.connect(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Admin connection timeout")), 10000)
            )
        ]);

        const topic = await admin.listTopics();

        if (!topic.includes("send-mail")) {
            await admin.createTopics({
                topics: [
                    {
                        topic: "send-mail",
                        numPartitions: 1,
                        replicationFactor: 1,
                    },
                ],
            });
            console.log("✅ Topic 'send-mail' created");
        }

        await admin.disconnect();

        producer = kafka.producer();

        // Connect producer with timeout
        await Promise.race([
            producer.connect(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Producer connection timeout")), 10000)
            )
        ]);

        console.log("✅ connected to kafka producer");
    }
    catch (error: any) {
        console.warn("⚠️  Failed to connect to kafka:", error.message || error);
        console.warn("⚠️  App will continue without Kafka. Email features may not work.");
        // Don't throw - allow app to continue without Kafka
    }
};

export const publishTopic = async (topic: string, message: any) => {

    if (!producer) {
        console.log("kafka producer is not initialized");
        return;
    }

    try {
        await producer.send({
            topic: topic,
            messages: [
                {
                    value: JSON.stringify(message),
                },
            ],
        })
    }
    catch (error) {
        console.log("Failed to publish message to kafka", error);
    }
};

export const disconnectKafka = async () => {
    if(producer){
        producer.disconnect();
    }
}