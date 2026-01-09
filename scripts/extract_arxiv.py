#!/usr/bin/env python3
"""
Extract the first X JSON objects from arxiv-metadata-oai-snapshot.json
and save them to a new file.
"""
import json
import sys

def extract_first_n_objects(input_file, output_file, n):
    """
    Extract the first n JSON objects from a newline-delimited JSON file.

    Args:
        input_file: Path to the input JSONL file
        output_file: Path to the output JSON file
        n: Number of objects to extract
    """
    objects = []

    print(f"Extracting first {n} JSON objects from {input_file}...")

    with open(input_file, 'r', encoding='utf-8') as infile:
        for i, line in enumerate(infile):
            if i >= n:
                break

            try:
                obj = json.loads(line.strip())
                objects.append(obj)
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse line {i+1}: {e}")
                continue

            # Progress indicator
            if (i + 1) % 100 == 0:
                print(f"  Processed {i + 1} objects...")

    print(f"Writing {len(objects)} objects to {output_file}...")

    with open(output_file, 'w', encoding='utf-8') as outfile:
        json.dump(objects, outfile, indent=2, ensure_ascii=False)

    print(f"Done! Extracted {len(objects)} objects to {output_file}")

if __name__ == "__main__":
    # Default values
    input_file = "arxiv-metadata-oai-snapshot.json"
    output_file = "arxiv_sample.json"
    n = 100  # Default: extract first 100 objects

    # Parse command line arguments
    if len(sys.argv) > 1:
        n = int(sys.argv[1])
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    if len(sys.argv) > 3:
        input_file = sys.argv[3]

    extract_first_n_objects(input_file, output_file, n)
