CC = g++
CFLAGS = -std=c++17 -O2
TARGET = engine
SRC = engine.cpp evaluate.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

clean:
	rm -f $(TARGET)

.PHONY: all clean
