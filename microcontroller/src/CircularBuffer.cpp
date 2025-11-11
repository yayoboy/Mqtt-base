#include "CircularBuffer.h"
#include <string.h>

CircularBuffer::CircularBuffer(size_t capacity)
    : head(0), tail(0), count(0), maxCapacity(capacity) {
    buffer = new BufferedMessage[capacity];
}

CircularBuffer::~CircularBuffer() {
    if (buffer) {
        delete[] buffer;
    }
}

bool CircularBuffer::push(const char* topic, const uint8_t* payload, size_t length) {
    if (isFull()) {
        return false;
    }

    BufferedMessage& msg = buffer[head];

    // Copy topic
    strncpy(msg.topic, topic, sizeof(msg.topic) - 1);
    msg.topic[sizeof(msg.topic) - 1] = '\0';

    // Copy payload
    size_t copyLen = min(length, sizeof(msg.payload) - 1);
    memcpy(msg.payload, payload, copyLen);
    msg.payload[copyLen] = '\0';
    msg.payloadLength = copyLen;

    // Set timestamp
    msg.timestamp = millis();

    // Update head
    head = (head + 1) % maxCapacity;
    count++;

    return true;
}

bool CircularBuffer::pop(BufferedMessage& message) {
    if (isEmpty()) {
        return false;
    }

    message = buffer[tail];
    tail = (tail + 1) % maxCapacity;
    count--;

    return true;
}

bool CircularBuffer::peek(BufferedMessage& message) {
    if (isEmpty()) {
        return false;
    }

    message = buffer[tail];
    return true;
}

size_t CircularBuffer::size() const {
    return count;
}

size_t CircularBuffer::capacity() const {
    return maxCapacity;
}

bool CircularBuffer::isEmpty() const {
    return count == 0;
}

bool CircularBuffer::isFull() const {
    return count >= maxCapacity;
}

float CircularBuffer::usagePercent() const {
    return (count * 100.0f) / maxCapacity;
}

void CircularBuffer::clear() {
    head = 0;
    tail = 0;
    count = 0;
}

void CircularBuffer::removeOldest() {
    if (!isEmpty()) {
        tail = (tail + 1) % maxCapacity;
        count--;
    }
}
