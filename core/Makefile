CC = g++
CFLAGS = -std=c++11 -O2
TARGET = engine
SRC = engine.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

clean:
	rm -f $(TARGET)

.PHONY: all clean
