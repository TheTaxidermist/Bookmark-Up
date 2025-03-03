import json  # For reading/writing JSON bookmark files
import os   # For handling file paths across operating systems
from collections import defaultdict  # For easy grouping of bookmarks
import nltk  # Natural Language Toolkit for text processing
from nltk.corpus import stopwords    # To filter common words (e.g., "the", "and")
from nltk.tokenize import word_tokenize  # To split bookmark names into words
import psutil  # To check if Brave is running
import shutil  # To create file backups
import time    # To timestamp backups

# Download required NLTK data (run once; safe to repeat)
nltk.download('punkt')       # Tokenizer data (legacy)
nltk.download('punkt_tab')   # Updated tokenizer data for word_tokenize
nltk.download('stopwords')   # Common words to ignore

# Path to Brave’s Bookmarks file (Mac-specific; ~ expands to /Users/tsc)
BRAVE_BOOKMARKS_PATH = os.path.expanduser(
    "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks"
)

def is_brave_running():
    """Check if Brave Browser is running on the system."""
    # Iterate over all running processes and look for 'Brave'
    for proc in psutil.process_iter(['name']):
        if 'Brave' in proc.info['name']:
            return True
    return False

# Initial feedback to user
print(f"Targeting Bookmarks file at: {BRAVE_BOOKMARKS_PATH}")
print("Welcome to Bookmark Up! Crafted by The Taxidermist at AD:HOC Codeworks—let’s mount those bookmarks beautifully!")

def load_bookmarks():
    """Read the Brave Bookmarks JSON file into a Python dictionary."""
    with open(BRAVE_BOOKMARKS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_bookmarks(node, bookmarks_list=None):
    """Recursively extract all URL bookmarks from the JSON structure."""
    # Initialize list on first call
    if bookmarks_list is None:
        bookmarks_list = []
    # If node has children, explore them
    if "children" in node:
        for child in node["children"]:
            if child["type"] == "url":  # Bookmark is a URL
                bookmarks_list.append(child)
            elif child["type"] == "folder":  # Dive into folders
                extract_bookmarks(child, bookmarks_list)
    return bookmarks_list

def simple_semantic_grouping(bookmarks):
    """Group bookmarks by shared keywords in their names."""
    # Load English stopwords to filter out noise
    stop_words = set(stopwords.words('english'))
    groups = defaultdict(list)  # Dictionary to collect bookmarks by keyword
    
    # Process each bookmark
    for bookmark in bookmarks:
        # Split name into words, lowercase for consistency
        words = word_tokenize(bookmark["name"].lower())
        # Filter: remove stopwords and short words (< 4 chars)
        keywords = [w for w in words if w not in stop_words and len(w) > 3]
        # Pick a group name: smallest keyword (alphabetically) or "misc"
        group_name = min(keywords) if keywords else "misc"
        groups[group_name].append(bookmark)
    
    # Clean up: merge tiny groups (< 2 bookmarks) into "misc"
    final_groups = defaultdict(list)
    for group_name, items in groups.items():
        if len(items) >= 2 or group_name == "misc":
            final_groups[group_name].extend(items)
        else:
            final_groups["misc"].extend(items)
    return final_groups

def build_new_structure(original_data, groups):
    """Build a fresh bookmark hierarchy from grouped bookmarks."""
    # Create a clean structure, keeping only essential metadata
    new_data = {
        "checksum": original_data.get("checksum", ""),  # Integrity hash (if present)
        "roots": {
            "bookmark_bar": {
                "children": [],
                "name": "Bookmark Bar",
                "type": "folder"
            },
            "other": {"children": [], "name": "Other Bookmarks", "type": "folder"},
            "synced": {"children": [], "name": "Synced Bookmarks", "type": "folder"}
        },
        "version": original_data.get("version", 1)  # File version (default 1)
    }
    # Add each group as a folder under Bookmark Bar
    for group_name, bookmarks in groups.items():
        folder = {
            "children": bookmarks,
            "name": group_name.capitalize(),  # No prefix, just the keyword
            "type": "folder",
            "date_added": bookmarks[0]["date_added"]  # Timestamp from first bookmark
        }
        new_data["roots"]["bookmark_bar"]["children"].append(folder)
    return new_data

def save_bookmarks(new_data):
    """Save the new bookmark structure with a Desktop backup."""
    # Create a timestamped backup file name
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.expanduser(f"~/Desktop/BookmarkUp_Backup_{timestamp}.bak")
    shutil.copy(BRAVE_BOOKMARKS_PATH, backup_path)  # Copy original to Desktop
    print(f"Backup created at: {backup_path}")
    
    # Write the new structure
    print("Attempting to save new bookmark structure...")
    with open(BRAVE_BOOKMARKS_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2)  # Pretty-print with indent
    print(f"Saved to {BRAVE_BOOKMARKS_PATH}! Relaunch Brave to see The Taxidermist’s handiwork!")

def main():
    """Main function to orchestrate bookmark organization."""
    # Safety check: ensure Brave is closed
    if is_brave_running():
        print("WARNING: Brave is running! Close all instances of Brave to avoid stuffing things up.")
        input("Press Enter to continue once Brave is closed, or Ctrl+C to abort: ")
        if is_brave_running():
            print("Brave’s still lurking! Aborting to keep your bookmarks safe.")
            return
    
    # Load, extract, group, and save bookmarks
    data = load_bookmarks()
    bookmarks = extract_bookmarks(data)  # Grab all bookmarks from all roots
    print(f"Found {len(bookmarks)} bookmarks to organize!")
    grouped_bookmarks = simple_semantic_grouping(bookmarks)
    print(f"Mounted into {len(grouped_bookmarks)} categories by AD:HOC Codeworks!")
    new_structure = build_new_structure(data, grouped_bookmarks)
    save_bookmarks(new_structure)

if __name__ == "__main__":
    """Entry point: run the script with error handling."""
    try:
        main()
    except FileNotFoundError:
        print("Oops! The Taxidermist couldn’t find your Brave Bookmarks file. Check the path!")
    except PermissionError:
        print("Yikes! No permission to write to the Bookmarks file. Try running with sudo or check perms!")
    except Exception as e:
        print(f"Uh-oh, taxidermy gone wrong: {e}")